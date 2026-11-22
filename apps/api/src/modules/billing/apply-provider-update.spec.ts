import { applyProviderUpdate } from './apply-provider-update.js';
import { type ProviderUpdate } from './payment-provider.js';
import { PaymentMode, type Subscription, SubscriptionStatus } from './subscription.entity.js';

const NOW = new Date('2026-11-21T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const ID = '3f2b8c1d-4e5a-4b6c-9d7e-8f9a0b1c2d3e';

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: ID,
    mode: PaymentMode.Preapproval,
    status: SubscriptionStatus.Pending,
    currentPeriodEnd: null,
    cancelledAt: null,
    lastPaymentId: null,
    ...overrides,
  } as Subscription;
}

const update = (overrides: Partial<ProviderUpdate>): ProviderUpdate => ({
  subscriptionId: ID,
  status: SubscriptionStatus.Authorized,
  period: { kind: 'keep' },
  ...overrides,
});

describe('applyProviderUpdate', () => {
  it('authorizes a preapproval until its next charge', () => {
    const until = new Date(NOW.getTime() + 30 * DAY_MS);
    const target = subscription();

    const result = applyProviderUpdate(
      target,
      update({ period: { kind: 'set', until } }),
      PaymentMode.Preapproval,
      NOW,
    );

    expect(result).toBe('applied');
    expect(target).toMatchObject({
      status: SubscriptionStatus.Authorized,
      currentPeriodEnd: until,
    });
  });

  it('extends a onetime pass from now, then from its end, once per payment', () => {
    const target = subscription({ mode: PaymentMode.Onetime });
    const extend = (paymentId: string) =>
      update({ period: { kind: 'extend', days: 30, paymentId } });

    applyProviderUpdate(target, extend('pay-1'), PaymentMode.Onetime, NOW);
    expect(target.currentPeriodEnd).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));

    expect(applyProviderUpdate(target, extend('pay-1'), PaymentMode.Onetime, NOW)).toBe(
      'already-applied',
    );
    expect(target.currentPeriodEnd).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));

    applyProviderUpdate(target, extend('pay-2'), PaymentMode.Onetime, NOW);
    expect(target.currentPeriodEnd).toEqual(new Date(NOW.getTime() + 60 * DAY_MS));
  });

  it('stamps cancelledAt once and keeps the paid period', () => {
    const end = new Date(NOW.getTime() + 10 * DAY_MS);
    const target = subscription({ status: SubscriptionStatus.Authorized, currentPeriodEnd: end });

    applyProviderUpdate(
      target,
      update({ status: SubscriptionStatus.Cancelled }),
      PaymentMode.Preapproval,
      NOW,
    );

    expect(target).toMatchObject({
      status: SubscriptionStatus.Cancelled,
      cancelledAt: NOW,
      currentPeriodEnd: end,
    });
  });

  it('ignores invalid transitions', () => {
    const target = subscription({ status: SubscriptionStatus.Cancelled });

    expect(applyProviderUpdate(target, update({}), PaymentMode.Preapproval, NOW)).toBe(
      'invalid-transition',
    );
    expect(target.status).toBe(SubscriptionStatus.Cancelled);
  });

  it('ignores updates read by the provider of another mode', () => {
    const target = subscription();

    expect(applyProviderUpdate(target, update({}), PaymentMode.Onetime, NOW)).toBe('mode-mismatch');
    expect(target.status).toBe(SubscriptionStatus.Pending);
  });
});
