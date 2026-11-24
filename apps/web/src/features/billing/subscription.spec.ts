import { describe, expect, it } from 'vitest';
import type { Subscription } from '@/lib/api/billing';
import { checkoutOutcome, describeSubscription, formatPrice, planFeatures } from './subscription';

const NOW = new Date('2026-11-21T12:00:00Z');

const subscription = (overrides: Partial<Subscription>): Subscription => ({
  id: 'sub-1',
  mode: 'preapproval',
  status: 'authorized',
  amount: 2999,
  currency: 'ARS',
  currentPeriodEnd: '2026-12-21T12:00:00.000Z',
  cancelledAt: null,
  createdAt: '2026-11-21T11:00:00.000Z',
  ...overrides,
});

describe('formatPrice', () => {
  it('drops decimals for whole amounts', () => {
    expect(formatPrice(2999, 'ARS')).toBe('ARS 2,999');
    expect(formatPrice(2999.5, 'ARS')).toBe('ARS 2,999.50');
  });
});

describe('checkoutOutcome', () => {
  it('waits while the newest subscription is pending', () => {
    expect(
      checkoutOutcome({ plan: 'free', subscription: subscription({ status: 'pending' }) }),
    ).toBe('waiting');
  });

  it('reports Premium once the plan flips', () => {
    expect(checkoutOutcome({ plan: 'premium', subscription: subscription({}) })).toBe('premium');
  });

  it('reports an unfinished checkout otherwise', () => {
    expect(
      checkoutOutcome({ plan: 'free', subscription: subscription({ status: 'cancelled' }) }),
    ).toBe('not-completed');
    expect(checkoutOutcome({ plan: 'free', subscription: null })).toBe('not-completed');
  });
});

describe('describeSubscription', () => {
  it('shows the renewal date of an active subscription', () => {
    expect(describeSubscription(subscription({}), NOW)).toMatchObject({
      label: 'Active',
      tone: 'success',
      detail: 'Renews on December 21, 2026.',
      cancellable: true,
    });
  });

  it('says a onetime pass does not renew', () => {
    expect(describeSubscription(subscription({ mode: 'onetime' }), NOW).detail).toBe(
      'Premium until December 21, 2026. It doesn’t renew.',
    );
  });

  it('keeps Premium after cancelling until the period ends', () => {
    expect(describeSubscription(subscription({ status: 'cancelled' }), NOW)).toMatchObject({
      label: 'Cancelled',
      detail: 'You keep Premium until December 21, 2026.',
      cancellable: false,
    });
    expect(
      describeSubscription(subscription({ status: 'cancelled', currentPeriodEnd: null }), NOW)
        .detail,
    ).toBe('You’re on the Free plan.');
  });

  it('lets a pending checkout be cancelled', () => {
    expect(
      describeSubscription(subscription({ status: 'pending', currentPeriodEnd: null }), NOW),
    ).toMatchObject({ label: 'Waiting for payment', cancellable: true });
  });
});

describe('planFeatures', () => {
  it('lists theme switching as the Premium difference, with 320 kbps on both plans', () => {
    const free = planFeatures({ maxPlaylists: 5, streamQuality: 'high', themes: false });
    const premium = planFeatures({ maxPlaylists: null, streamQuality: 'high', themes: true });

    expect(free).toEqual([
      'Up to 5 playlists',
      'The classic Waven theme',
      'High-quality audio (320 kbps)',
      'Liked Songs and listening history',
    ]);
    expect(premium).toEqual([
      'Unlimited playlists',
      'Switch between themes and backdrops',
      'High-quality audio (320 kbps)',
      'Liked Songs and listening history',
    ]);
  });
});
