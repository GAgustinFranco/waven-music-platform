import { SubscriptionStatus } from '../billing/subscription.entity.js';

export enum Plan {
  Free = 'free',
  Premium = 'premium',
}

export enum StreamQuality {
  Standard = 'std',
  High = 'high',
}

export interface PlanLimits {
  /** `null` means unlimited. */
  maxPlaylists: number | null;
  streamQuality: StreamQuality;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.Free]: { maxPlaylists: 5, streamQuality: StreamQuality.Standard },
  [Plan.Premium]: { maxPlaylists: null, streamQuality: StreamQuality.High },
};

/** The fields of a subscription the plan depends on. */
export interface PlanSubscription {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
}

/** Statuses that grant Premium while the paid period lasts (business rule 1). */
export const PREMIUM_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.Authorized,
  SubscriptionStatus.Cancelled,
];

/**
 * Business rule 1: Premium while an `authorized` subscription, or a `cancelled`
 * one, still has paid time left. Everything else is Free.
 */
export function getEffectivePlan(
  subscriptions: readonly PlanSubscription[],
  now = new Date(),
): Plan {
  const premium = subscriptions.some(
    (subscription) =>
      PREMIUM_STATUSES.includes(subscription.status) &&
      subscription.currentPeriodEnd !== null &&
      subscription.currentPeriodEnd.getTime() > now.getTime(),
  );
  return premium ? Plan.Premium : Plan.Free;
}
