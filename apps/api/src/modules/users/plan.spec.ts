import { SubscriptionStatus } from '../billing/subscription.entity.js';
import { getEffectivePlan, Plan } from './plan.js';

const NOW = new Date('2026-11-21T12:00:00Z');
const LATER = new Date('2026-12-21T12:00:00Z');
const EARLIER = new Date('2026-11-20T12:00:00Z');

describe('getEffectivePlan', () => {
  it('is Free without subscriptions', () => {
    expect(getEffectivePlan([], NOW)).toBe(Plan.Free);
  });

  it('is Premium with an authorized subscription inside its period', () => {
    expect(
      getEffectivePlan([{ status: SubscriptionStatus.Authorized, currentPeriodEnd: LATER }], NOW),
    ).toBe(Plan.Premium);
  });

  it('keeps Premium after cancelling until the paid period ends', () => {
    const cancelled = { status: SubscriptionStatus.Cancelled, currentPeriodEnd: LATER };
    expect(getEffectivePlan([cancelled], NOW)).toBe(Plan.Premium);
    expect(getEffectivePlan([cancelled], LATER)).toBe(Plan.Free);
  });

  it.each([
    [SubscriptionStatus.Authorized, EARLIER],
    [SubscriptionStatus.Authorized, null],
    [SubscriptionStatus.Pending, LATER],
    [SubscriptionStatus.Paused, LATER],
    [SubscriptionStatus.Cancelled, null],
  ])('is Free for %s ending %s', (status, currentPeriodEnd) => {
    expect(getEffectivePlan([{ status, currentPeriodEnd }], NOW)).toBe(Plan.Free);
  });
});
