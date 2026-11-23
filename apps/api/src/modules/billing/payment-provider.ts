import { type PaymentMode, type SubscriptionStatus } from './subscription.entity.js';

/** Injection token of every `PaymentProvider` (one per `PaymentMode`). */
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');

/** Stored in `Subscription.provider` and `WebhookEvent.provider`. */
export const MERCADO_PAGO = 'mercadopago';

export interface CheckoutInput {
  /** Our Subscription id, sent as the provider's external reference. */
  subscriptionId: string;
  amount: number;
  currency: string;
  title: string;
  payerEmail: string;
  /** Where the provider sends the buyer when they finish or leave the checkout. */
  backUrl: string;
}

export interface CheckoutSession {
  /** The provider's id of what was created (a preapproval or a preference). */
  externalId: string;
  redirectUrl: string;
}

/** How an update moves the end of the paid period. */
export type PeriodChange =
  | { kind: 'keep' }
  /** The provider states the end of the period (the next charge of a subscription). */
  | { kind: 'set'; until: Date }
  /** One payment buys `days` more from `max(now, currentPeriodEnd)` (business rule 8). */
  | { kind: 'extend'; days: number; paymentId: string }
  /** Access ends now (for example, after a refund). */
  | { kind: 'end' };

/** A provider resource translated into the domain, always read from the provider's API. */
export interface ProviderUpdate {
  subscriptionId: string;
  status: SubscriptionStatus;
  period: PeriodChange;
}

/**
 * A way to charge for Premium. The domain (Subscription and its states) only
 * talks to this interface; `PAYMENT_MODE` picks the one used for new checkouts.
 */
export interface PaymentProvider {
  readonly mode: PaymentMode;
  /** Webhook `type` values whose resources this provider reads. */
  readonly notificationTypes: readonly string[];
  /** False while credentials are missing. */
  isAvailable(): boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** Fetches the notified resource again; `null` when it is unknown or not ours. */
  fetchUpdate(type: string, resourceId: string): Promise<ProviderUpdate | null>;
  /** Reads the current state of a checkout without a notification (a late webhook). */
  sync(subscriptionId: string, externalId: string): Promise<ProviderUpdate | null>;
  /** Stops future charges, if the mode has any. */
  cancel(externalId: string): Promise<void>;
}

/** The provider failed or answered something unexpected. */
export class PaymentProviderError extends Error {
  override readonly name = 'PaymentProviderError';
}
