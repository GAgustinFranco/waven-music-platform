import { SubscriptionStatus } from '../subscription.entity.js';
import { paymentToUpdate } from './mercadopago-checkout-pro.provider.js';
import { preapprovalToUpdate } from './mercadopago-preapproval.provider.js';

const SUBSCRIPTION_ID = '3f2b8c1d-4e5a-4b6c-9d7e-8f9a0b1c2d3e';

describe('preapprovalToUpdate', () => {
  it('sets the period to the next charge while authorized', () => {
    expect(
      preapprovalToUpdate({
        id: 'pre-1',
        status: 'authorized',
        external_reference: SUBSCRIPTION_ID,
        next_payment_date: '2026-12-21T12:00:00.000-03:00',
      }),
    ).toEqual({
      subscriptionId: SUBSCRIPTION_ID,
      status: SubscriptionStatus.Authorized,
      period: { kind: 'set', until: new Date('2026-12-21T15:00:00.000Z') },
    });
  });

  it('keeps the period when cancelled', () => {
    expect(
      preapprovalToUpdate({
        status: 'cancelled',
        external_reference: SUBSCRIPTION_ID,
        next_payment_date: '2026-12-21T12:00:00.000-03:00',
      }),
    ).toMatchObject({ status: SubscriptionStatus.Cancelled, period: { kind: 'keep' } });
  });

  it.each([
    [{ status: 'authorized', external_reference: 'not-ours' }],
    [{ status: 'finished', external_reference: SUBSCRIPTION_ID }],
    [{ status: 'authorized' }],
  ])('ignores %j', (resource) => {
    expect(preapprovalToUpdate(resource)).toBeNull();
  });
});

describe('paymentToUpdate', () => {
  it('extends the period by 30 days for an approved payment', () => {
    expect(
      paymentToUpdate({ id: 123, status: 'approved', external_reference: SUBSCRIPTION_ID }),
    ).toEqual({
      subscriptionId: SUBSCRIPTION_ID,
      status: SubscriptionStatus.Authorized,
      period: { kind: 'extend', days: 30, paymentId: '123' },
    });
  });

  it('ends access after a refund', () => {
    expect(
      paymentToUpdate({ id: 123, status: 'refunded', external_reference: SUBSCRIPTION_ID }),
    ).toMatchObject({ status: SubscriptionStatus.Cancelled, period: { kind: 'end' } });
  });

  it.each(['pending', 'in_process', 'rejected'])('ignores a %s payment', (status) => {
    expect(paymentToUpdate({ id: 1, status, external_reference: SUBSCRIPTION_ID })).toBeNull();
  });
});
