import { SubscriptionStatus } from './subscription.entity.js';

const { Pending, Authorized, Paused, Cancelled } = SubscriptionStatus;

/** Allowed moves of the Subscription state machine; `cancelled` is final. */
const TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  [Pending]: [Authorized, Cancelled],
  [Authorized]: [Paused, Cancelled],
  [Paused]: [Authorized, Cancelled],
  [Cancelled]: [],
};

/** Staying in the same status is allowed, so a refreshed period can still be applied. */
export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}
