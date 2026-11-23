import { type ProviderUpdate } from './payment-provider.js';
import { canTransition } from './subscription-state.js';
import { type PaymentMode, type Subscription, SubscriptionStatus } from './subscription.entity.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export type ApplyResult = 'applied' | 'mode-mismatch' | 'invalid-transition' | 'already-applied';

/**
 * Applies a provider update to a subscription in place. Updates read by the
 * provider of another mode (a recurring charge also arrives as a payment) and
 * invalid transitions change nothing (business rule 9).
 */
export function applyProviderUpdate(
  subscription: Subscription,
  update: ProviderUpdate,
  providerMode: PaymentMode,
  now = new Date(),
): ApplyResult {
  if (subscription.mode !== providerMode) {
    return 'mode-mismatch';
  }
  if (!canTransition(subscription.status, update.status)) {
    return 'invalid-transition';
  }

  const { period } = update;
  switch (period.kind) {
    case 'extend': {
      if (subscription.lastPaymentId === period.paymentId) {
        return 'already-applied';
      }
      // Business rule 8: each approved payment adds days to max(now, currentPeriodEnd).
      const from = Math.max(now.getTime(), subscription.currentPeriodEnd?.getTime() ?? 0);
      subscription.currentPeriodEnd = new Date(from + period.days * DAY_MS);
      subscription.lastPaymentId = period.paymentId;
      break;
    }
    case 'set':
      subscription.currentPeriodEnd = period.until;
      break;
    case 'end':
      subscription.currentPeriodEnd = now;
      break;
    case 'keep':
      break;
  }

  if (update.status === SubscriptionStatus.Cancelled && subscription.cancelledAt === null) {
    subscription.cancelledAt = now;
  }
  subscription.status = update.status;
  return 'applied';
}
