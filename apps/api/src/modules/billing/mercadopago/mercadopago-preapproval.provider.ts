import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  PaymentProviderError,
  type ProviderUpdate,
} from '../payment-provider.js';
import { PaymentMode, SubscriptionStatus } from '../subscription.entity.js';
import { MercadoPagoClient, readDate, readId } from './mercadopago.client.js';

const PREAPPROVAL_TYPES = ['subscription_preapproval', 'preapproval'];
const AUTHORIZED_PAYMENT_TYPE = 'subscription_authorized_payment';

const STATUS_BY_MP: Record<string, SubscriptionStatus> = {
  pending: SubscriptionStatus.Pending,
  authorized: SubscriptionStatus.Authorized,
  paused: SubscriptionStatus.Paused,
  cancelled: SubscriptionStatus.Cancelled,
};

/** Translates a preapproval resource; exported for the unit tests. */
export function preapprovalToUpdate(resource: Record<string, unknown>): ProviderUpdate | null {
  const subscriptionId = readId(resource, 'external_reference');
  const rawStatus = resource['status'];
  const status = typeof rawStatus === 'string' ? STATUS_BY_MP[rawStatus] : undefined;
  if (!subscriptionId || !isUUID(subscriptionId) || !status) {
    return null;
  }
  // While authorized, the paid period runs until the next charge.
  const nextPayment = readDate(resource, 'next_payment_date');
  return {
    subscriptionId,
    status,
    period:
      status === SubscriptionStatus.Authorized && nextPayment
        ? { kind: 'set', until: nextPayment }
        : { kind: 'keep' },
  };
}

/** Monthly subscription without a plan (`/preapproval`): Mercado Pago charges every month. */
@Injectable()
export class MercadoPagoPreapprovalProvider implements PaymentProvider {
  readonly mode = PaymentMode.Preapproval;
  readonly notificationTypes = [...PREAPPROVAL_TYPES, AUTHORIZED_PAYMENT_TYPE];

  constructor(private readonly client: MercadoPagoClient) {}

  isAvailable(): boolean {
    return this.client.isConfigured();
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const created = await this.client.create(
      '/preapproval',
      {
        reason: input.title,
        external_reference: input.subscriptionId,
        payer_email: input.payerEmail,
        back_url: input.backUrl,
        status: 'pending',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: input.amount,
          currency_id: input.currency,
        },
      },
      input.subscriptionId,
    );
    const externalId = readId(created, 'id');
    const redirectUrl = readId(created, 'init_point');
    if (!externalId || !redirectUrl) {
      throw new PaymentProviderError('Mercado Pago preapproval has no id or init_point');
    }
    return { externalId, redirectUrl };
  }

  async fetchUpdate(type: string, resourceId: string): Promise<ProviderUpdate | null> {
    let preapprovalId: string | null = resourceId;
    if (type === AUTHORIZED_PAYMENT_TYPE) {
      // A monthly charge: its preapproval holds the subscription's state.
      const payment = await this.client.find(
        `/authorized_payments/${encodeURIComponent(resourceId)}`,
      );
      preapprovalId = payment ? readId(payment, 'preapproval_id') : null;
    }
    if (!preapprovalId) {
      return null;
    }
    const preapproval = await this.client.find(`/preapproval/${encodeURIComponent(preapprovalId)}`);
    return preapproval ? preapprovalToUpdate(preapproval) : null;
  }

  sync(_subscriptionId: string, externalId: string): Promise<ProviderUpdate | null> {
    return this.fetchUpdate('subscription_preapproval', externalId);
  }

  async cancel(externalId: string): Promise<void> {
    await this.client.update(`/preapproval/${encodeURIComponent(externalId)}`, {
      status: 'cancelled',
    });
  }
}
