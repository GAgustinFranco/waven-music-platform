import type { BillingStatus, PlanOffer, Subscription } from '@/lib/api/billing';

/** What a plan includes, from its limits. Audio is 320 kbps on every plan. */
export function planFeatures(limits: PlanOffer['limits']): string[] {
  return [
    limits.maxPlaylists === null ? 'Unlimited playlists' : `Up to ${limits.maxPlaylists} playlists`,
    limits.themes ? 'Switch between themes and backdrops' : 'The classic Waven theme',
    'High-quality audio (320 kbps)',
    'Liked Songs and listening history',
  ];
}

/** "ARS 2,999" (major units, no decimals when whole). */
export function formatPrice(amount: number, currency: string): string {
  const number = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${number}`;
}

/** "December 21, 2026" in the user's time zone; null for a missing or invalid date. */
export function formatLongDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export type CheckoutOutcome = 'waiting' | 'premium' | 'not-completed';

/**
 * What `/billing/return` shows while it polls: Premium once the plan flips,
 * "not completed" when the newest subscription left `pending` without it (or
 * there is none), and waiting otherwise.
 */
export function checkoutOutcome(status: BillingStatus): CheckoutOutcome {
  if (status.plan === 'premium') {
    return 'premium';
  }
  return status.subscription?.status === 'pending' ? 'waiting' : 'not-completed';
}

export interface SubscriptionSummary {
  label: string;
  tone: 'success' | 'warning' | 'muted';
  /** One sentence about the period or what happens next. */
  detail: string;
  /** Whether the user can cancel it. */
  cancellable: boolean;
}

/** Labels for the profile's subscription card. */
export function describeSubscription(
  subscription: Subscription,
  now = new Date(),
): SubscriptionSummary {
  const end = formatLongDate(subscription.currentPeriodEnd);
  const ended =
    subscription.currentPeriodEnd !== null &&
    new Date(subscription.currentPeriodEnd).getTime() <= now.getTime();
  const recurring = subscription.mode === 'preapproval';

  switch (subscription.status) {
    case 'pending':
      return {
        label: 'Waiting for payment',
        tone: 'warning',
        detail: 'Mercado Pago hasn’t confirmed the payment yet.',
        cancellable: true,
      };
    case 'authorized':
      if (ended || !end) {
        return {
          label: recurring ? 'Payment due' : 'Expired',
          tone: 'warning',
          detail: recurring
            ? 'Mercado Pago hasn’t confirmed this month’s payment yet.'
            : 'Your 30 days of Premium are over.',
          cancellable: recurring,
        };
      }
      return {
        label: 'Active',
        tone: 'success',
        detail: recurring ? `Renews on ${end}.` : `Premium until ${end}. It doesn’t renew.`,
        cancellable: true,
      };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'warning',
        detail: 'Charges are paused in Mercado Pago, so you’re on Free.',
        cancellable: true,
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'muted',
        detail: end && !ended ? `You keep Premium until ${end}.` : 'You’re on the Free plan.',
        cancellable: false,
      };
  }
}
