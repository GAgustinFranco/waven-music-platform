import { canTransition } from './subscription-state.js';
import { SubscriptionStatus } from './subscription.entity.js';

const { Pending, Authorized, Paused, Cancelled } = SubscriptionStatus;

describe('canTransition', () => {
  it.each([
    [Pending, Authorized],
    [Pending, Cancelled],
    [Authorized, Paused],
    [Authorized, Cancelled],
    [Paused, Authorized],
    [Paused, Cancelled],
    [Authorized, Authorized],
    [Cancelled, Cancelled],
  ])('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    [Cancelled, Authorized],
    [Cancelled, Pending],
    [Cancelled, Paused],
    [Authorized, Pending],
    [Paused, Pending],
    [Pending, Paused],
  ])('rejects %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});
