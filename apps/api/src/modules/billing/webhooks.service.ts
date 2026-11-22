import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { BillingService } from './billing.service.js';
import { isRecord, readId } from './mercadopago/mercadopago.client.js';
import { verifyMercadoPagoSignature } from './mercadopago/mercadopago-signature.js';
import { MERCADO_PAGO } from './payment-provider.js';
import { PaymentProviders } from './payment-providers.service.js';
import { WebhookEvent } from './webhook-event.entity.js';

export interface IncomingWebhook {
  signature: string | undefined;
  requestId: string | undefined;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
}

export type WebhookResult = 'processed' | 'duplicate' | 'ignored';

const queryString = (query: Record<string, unknown>, key: string): string | undefined => {
  const value = query[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
};

/**
 * Mercado Pago webhooks (business rule 9): the signature is checked first,
 * every event is processed at most once, and the state always comes from the
 * Mercado Pago API, never from the payload.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly secret: string | undefined;

  constructor(
    @InjectRepository(WebhookEvent) private readonly events: Repository<WebhookEvent>,
    private readonly dataSource: DataSource,
    private readonly providers: PaymentProviders,
    private readonly billing: BillingService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secret = config.get('MP_WEBHOOK_SECRET', { infer: true });
  }

  async handle(incoming: IncomingWebhook): Promise<WebhookResult> {
    const queryDataId = queryString(incoming.query, 'data.id');
    const valid = verifyMercadoPagoSignature({
      header: incoming.signature,
      requestId: incoming.requestId,
      dataId: queryDataId,
      secret: this.secret,
    });
    if (!valid) {
      this.logger.warn({ requestId: incoming.requestId }, 'Webhook with an invalid signature');
      throw new UnauthorizedException({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Invalid signature',
      });
    }

    const { body } = incoming;
    const type =
      (typeof body['type'] === 'string' ? body['type'] : undefined) ??
      queryString(incoming.query, 'type');
    const data = isRecord(body['data']) ? body['data'] : {};
    const dataId = queryDataId ?? readId(data, 'id');
    const eventId = readId(body, 'id') ?? incoming.requestId;
    if (!type || !dataId || !eventId) {
      this.logger.warn({ requestId: incoming.requestId }, 'Webhook without type, data.id or id');
      return 'ignored';
    }

    // Claims the event; a delivery that already succeeded is not processed again.
    await this.dataSource.query(
      `INSERT INTO "webhook_events" ("provider", "external_event_id", "type", "payload")
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [MERCADO_PAGO, eventId, type.slice(0, 64), JSON.stringify(body)],
    );

    try {
      return await this.dataSource.transaction(async (manager) => {
        const event = await manager.findOneOrFail(WebhookEvent, {
          where: { provider: MERCADO_PAGO, externalEventId: eventId },
          lock: { mode: 'pessimistic_write' },
        });
        if (event.processedAt) {
          return 'duplicate';
        }
        const provider = this.providers.forNotification(type);
        const update = provider ? await provider.fetchUpdate(type, dataId) : null;
        if (provider && update) {
          await this.billing.applyUpdate(manager, update, provider.mode);
        }
        event.processedAt = new Date();
        event.error = null;
        await manager.save(event);
        return update ? 'processed' : 'ignored';
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.events.update(
        { provider: MERCADO_PAGO, externalEventId: eventId },
        { error: message.slice(0, 1000) },
      );
      this.logger.error({ err: error, eventId, type }, 'Webhook processing failed');
      // A non-2xx answer makes Mercado Pago retry later.
      throw new ServiceUnavailableException({
        code: 'WEBHOOK_PROCESSING_FAILED',
        message: 'The notification could not be processed',
      });
    }
  }
}
