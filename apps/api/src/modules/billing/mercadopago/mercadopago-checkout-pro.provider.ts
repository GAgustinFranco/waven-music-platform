import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PREMIUM_PERIOD_DAYS } from '../billing.constants.js';
import {
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  PaymentProviderError,
  type ProviderUpdate,
} from '../payment-provider.js';
import { PaymentMode, SubscriptionStatus } from '../subscription.entity.js';
import { isRecord, MercadoPagoClient, readId } from './mercadopago.client.js';

/** Translates a payment resource; exported for the unit tests. */
export function paymentToUpdate(resource: Record<string, unknown>): ProviderUpdate | null {
  const subscriptionId = readId(resource, 'external_reference');
  const paymentId = readId(resource, 'id');
  if (!subscriptionId || !isUUID(subscriptionId) || !paymentId) {
    return null;
  }
  switch (resource['status']) {
    case 'approved':
      return {
        subscriptionId,
        status: SubscriptionStatus.Authorized,
        period: { kind: 'extend', days: PREMIUM_PERIOD_DAYS, paymentId },
      };
    case 'refunded':
    case 'charged_back':
      return { subscriptionId, status: SubscriptionStatus.Cancelled, period: { kind: 'end' } };
    default:
      // pending, in_process or rejected: the buyer can still pay the same preference.
      return null;
  }
}

/** One payment through Checkout Pro buys 30 days of Premium; nothing renews by itself. */
@Injectable()
export class MercadoPagoCheckoutProProvider implements PaymentProvider {
  readonly mode = PaymentMode.Onetime;
  readonly notificationTypes = ['payment'];

  constructor(private readonly client: MercadoPagoClient) {}

  isAvailable(): boolean {
    return this.client.isConfigured();
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const backUrls = { success: input.backUrl, failure: input.backUrl, pending: input.backUrl };
    const created = await this.client.create(
      '/checkout/preferences',
      {
        items: [
          {
            id: 'premium-30-days',
            title: input.title,
            quantity: 1,
            unit_price: input.amount,
            currency_id: input.currency,
          },
        ],
        external_reference: input.subscriptionId,
        payer: { email: input.payerEmail },
        back_urls: backUrls,
        // Mercado Pago only returns automatically to https URLs.
        ...(input.backUrl.startsWith('https://') ? { auto_return: 'approved' } : {}),
      },
      input.subscriptionId,
    );
    const externalId = readId(created, 'id');
    const redirectUrl = readId(
      created,
      this.client.usesTestCredentials() ? 'sandbox_init_point' : 'init_point',
    );
    if (!externalId || !redirectUrl) {
      throw new PaymentProviderError('Mercado Pago preference has no id or init_point');
    }
    return { externalId, redirectUrl };
  }

  async fetchUpdate(_type: string, resourceId: string): Promise<ProviderUpdate | null> {
    const payment = await this.client.find(`/v1/payments/${encodeURIComponent(resourceId)}`);
    return payment ? paymentToUpdate(payment) : null;
  }

  /** The newest approved payment of this checkout, found by its external reference. */
  async sync(subscriptionId: string): Promise<ProviderUpdate | null> {
    const search = await this.client.find(
      `/v1/payments/search?external_reference=${encodeURIComponent(subscriptionId)}&sort=date_created&criteria=desc`,
    );
    const results = search && Array.isArray(search['results']) ? search['results'] : [];
    const approved = results.find(
      (payment): payment is Record<string, unknown> =>
        isRecord(payment) && payment['status'] === 'approved',
    );
    return approved ? paymentToUpdate(approved) : null;
  }

  /** Nothing renews; expiring the preference stops a pending checkout from being paid later. */
  async cancel(externalId: string): Promise<void> {
    await this.client.update(`/checkout/preferences/${encodeURIComponent(externalId)}`, {
      expires: true,
      expiration_date_to: new Date().toISOString(),
    });
  }
}
