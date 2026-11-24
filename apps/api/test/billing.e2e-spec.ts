import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  buildManifest,
  signManifest,
} from '../src/modules/billing/mercadopago/mercadopago-signature.js';
import {
  type CheckoutInput,
  type CheckoutSession,
  PAYMENT_PROVIDERS,
  type PaymentProvider,
  PaymentProviderError,
  type ProviderUpdate,
} from '../src/modules/billing/payment-provider.js';
import { PaymentMode, SubscriptionStatus } from '../src/modules/billing/subscription.entity.js';
import { MAIL_DRIVER } from '../src/modules/mail/mail.types.js';
import { type MemoryMailDriver } from '../src/modules/mail/memory-mail.driver.js';
import { insertCatalog } from './fixtures.js';
import { createTestApp, resetDatabase, type TestApp, testLogin } from './utils.js';

const SECRET = 'test-webhook-secret';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Stands in for Mercado Pago: tests decide what "the provider's API" answers. */
class FakeProvider implements PaymentProvider {
  readonly resources = new Map<string, ProviderUpdate | 'fail'>();
  readonly checkouts: CheckoutInput[] = [];
  readonly cancelled: string[] = [];
  fetches = 0;

  constructor(
    readonly mode: PaymentMode,
    readonly notificationTypes: readonly string[],
  ) {}

  isAvailable(): boolean {
    return true;
  }

  createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    this.checkouts.push(input);
    return Promise.resolve({
      externalId: `fake-${input.subscriptionId}`,
      redirectUrl: `https://checkout.fake/${input.subscriptionId}`,
    });
  }

  fetchUpdate(_type: string, resourceId: string): Promise<ProviderUpdate | null> {
    this.fetches += 1;
    const resource = this.resources.get(resourceId);
    if (resource === 'fail') {
      return Promise.reject(new PaymentProviderError('Mercado Pago is down'));
    }
    return Promise.resolve(resource ?? null);
  }

  readonly synced = new Map<string, ProviderUpdate>();

  sync(_subscriptionId: string, externalId: string): Promise<ProviderUpdate | null> {
    return Promise.resolve(this.synced.get(externalId) ?? null);
  }

  cancel(externalId: string): Promise<void> {
    this.cancelled.push(externalId);
    return Promise.resolve();
  }
}

/** Sends a notification signed like Mercado Pago does. */
function webhook(
  ctx: TestApp,
  event: { id: string; type: string; dataId: string },
  secret = SECRET,
) {
  const requestId = `req-${event.id}`;
  const ts = String(Date.now());
  const v1 = signManifest(buildManifest(event.dataId, requestId, ts), secret);
  return request(ctx.server)
    .post(`/webhooks/mercadopago?data.id=${event.dataId}&type=${event.type}`)
    .set('x-signature', `ts=${ts},v1=${v1}`)
    .set('x-request-id', requestId)
    .send({ id: event.id, type: event.type, action: 'updated', data: { id: event.dataId } });
}

describe('Billing (e2e)', () => {
  let ctx: TestApp;
  let fan: { Authorization: string };
  let trackId: string;
  const preapproval = new FakeProvider(PaymentMode.Preapproval, ['subscription_preapproval']);
  const onetime = new FakeProvider(PaymentMode.Onetime, ['payment']);

  beforeAll(async () => {
    ctx = await createTestApp((builder) =>
      builder.overrideProvider(PAYMENT_PROVIDERS).useValue([preapproval, onetime]),
    );
    await resetDatabase(ctx.app);
    const login = await testLogin(ctx.server, { email: 'payer@waven.test' });
    fan = { Authorization: `Bearer ${login.accessToken}` };
    const catalog = await insertCatalog(ctx.app, {
      artist: 'Billing Artist',
      album: 'Billing Album',
      tracks: [{ title: 'Premium Song' }],
    });
    trackId = catalog.trackIds[0] ?? '';
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  const status = async () =>
    (await request(ctx.server).get('/billing/subscription').set(fan).expect(200)).body as {
      plan: string;
      subscription: { id: string; status: string; currentPeriodEnd: string | null } | null;
    };

  /** Premium welcomes sent to the payer; sending happens after the response. */
  const premiumWelcomes = () =>
    ctx.app
      .get<MemoryMailDriver>(MAIL_DRIVER)
      .to('payer@waven.test')
      .filter((message) => message.subject === 'Welcome to Waven Premium');

  const eventCount = async (): Promise<number> => {
    const rows: { count: string }[] = await ctx.app
      .get(DataSource)
      .query('SELECT count(*) FROM webhook_events');
    return Number(rows[0]?.count);
  };

  it('lists the plans for the configured mode', async () => {
    const response = await request(ctx.server).get('/billing/plans').set(fan).expect(200);

    expect(response.body.mode).toBe('preapproval');
    expect(response.body.items).toMatchObject([
      {
        id: 'free',
        amount: 0,
        limits: { maxPlaylists: 5, streamQuality: 'high', themes: false },
      },
      { id: 'premium', amount: 2999, currency: 'ARS', periodDays: 30 },
    ]);
  });

  it('starts on Free without a subscription', async () => {
    expect(await status()).toEqual({ plan: 'free', subscription: null });
    const stream = await request(ctx.server).post(`/tracks/${trackId}/stream`).set(fan).expect(200);
    expect(stream.body.quality).toBe('high');
  });

  it('requires a session for billing routes', async () => {
    await request(ctx.server).post('/billing/checkout').expect(401);
  });

  let subscriptionId: string;

  it('creates a pending subscription and returns the checkout URL', async () => {
    const response = await request(ctx.server).post('/billing/checkout').set(fan).expect(200);

    const current = await status();
    subscriptionId = current.subscription?.id ?? '';
    expect(response.body.redirectUrl).toBe(`https://checkout.fake/${subscriptionId}`);
    expect(current).toMatchObject({ plan: 'free', subscription: { status: 'pending' } });
    expect(preapproval.checkouts.at(-1)).toMatchObject({
      subscriptionId,
      amount: 2999,
      currency: 'ARS',
      payerEmail: 'payer@waven.test',
      backUrl: 'https://tunnel.waven.test/api/billing/return',
    });
  });

  it('rejects a second checkout with 409 while one is pending', async () => {
    const response = await request(ctx.server).post('/billing/checkout').set(fan).expect(409);
    expect(response.body.code).toBe('SUBSCRIPTION_EXISTS');
  });

  it('forwards the buyer from the back URL to the web', async () => {
    const response = await request(ctx.server).get('/billing/return?preapproval_id=x').expect(302);
    expect(response.headers.location).toBe('http://localhost:3000/billing/return');
  });

  describe('webhook signature', () => {
    it('returns 401 for an invalid signature and stores nothing', async () => {
      const before = await eventCount();
      const response = await webhook(
        ctx,
        { id: 'evt-bad', type: 'subscription_preapproval', dataId: 'pre-1' },
        'wrong-secret',
      ).expect(401);

      expect(response.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
      expect(await eventCount()).toBe(before);
    });

    it('returns 401 without a signature', async () => {
      await request(ctx.server)
        .post('/webhooks/mercadopago?data.id=pre-1&type=subscription_preapproval')
        .send({ id: 'evt-none', type: 'subscription_preapproval', data: { id: 'pre-1' } })
        .expect(401);
    });
  });

  it('activates Premium from the state fetched from the provider', async () => {
    const until = new Date(Date.now() + 30 * DAY_MS);
    preapproval.resources.set('pre-1', {
      subscriptionId,
      status: SubscriptionStatus.Authorized,
      period: { kind: 'set', until },
    });

    const response = await webhook(ctx, {
      id: 'evt-1',
      type: 'subscription_preapproval',
      dataId: 'pre-1',
    }).expect(200);

    expect(response.body.result).toBe('processed');
    expect(await status()).toMatchObject({
      plan: 'premium',
      subscription: { status: 'authorized', currentPeriodEnd: until.toISOString() },
    });
    const me = await request(ctx.server).get('/me').set(fan).expect(200);
    expect(me.body).toMatchObject({
      plan: 'premium',
      limits: { maxPlaylists: null, streamQuality: 'high', themes: true },
    });
    const stream = await request(ctx.server).post(`/tracks/${trackId}/stream`).set(fan).expect(200);
    expect(stream.body.quality).toBe('high');
    await vi.waitFor(() => expect(premiumWelcomes()).toHaveLength(1));
    expect(premiumWelcomes()[0]?.text).toContain('switch between themes');
  });

  it('answers 200 to a duplicate event and changes nothing', async () => {
    const before = await status();
    const fetches = preapproval.fetches;
    // Even if the provider now said otherwise, a processed event is not run again.
    preapproval.resources.set('pre-1', {
      subscriptionId,
      status: SubscriptionStatus.Cancelled,
      period: { kind: 'end' },
    });

    const response = await webhook(ctx, {
      id: 'evt-1',
      type: 'subscription_preapproval',
      dataId: 'pre-1',
    }).expect(200);

    expect(response.body.result).toBe('duplicate');
    expect(preapproval.fetches).toBe(fetches);
    expect(await status()).toEqual(before);
    expect(premiumWelcomes()).toHaveLength(1);
  });

  it('ignores an invalid transition', async () => {
    preapproval.resources.set('pre-2', {
      subscriptionId,
      status: SubscriptionStatus.Pending,
      period: { kind: 'keep' },
    });

    await webhook(ctx, { id: 'evt-2', type: 'subscription_preapproval', dataId: 'pre-2' }).expect(
      200,
    );

    expect((await status()).subscription?.status).toBe('authorized');
  });

  it('ignores updates read by the provider of the other mode', async () => {
    onetime.resources.set('pay-1', {
      subscriptionId,
      status: SubscriptionStatus.Authorized,
      period: { kind: 'extend', days: 30, paymentId: 'pay-1' },
    });
    const before = await status();

    await webhook(ctx, { id: 'evt-3', type: 'payment', dataId: 'pay-1' }).expect(200);

    expect(await status()).toEqual(before);
  });

  it('answers 503 when the provider fails and processes the retry', async () => {
    preapproval.resources.set('pre-3', 'fail');
    await webhook(ctx, { id: 'evt-4', type: 'subscription_preapproval', dataId: 'pre-3' }).expect(
      503,
    );

    preapproval.resources.set('pre-3', {
      subscriptionId,
      status: SubscriptionStatus.Authorized,
      period: { kind: 'keep' },
    });
    const retry = await webhook(ctx, {
      id: 'evt-4',
      type: 'subscription_preapproval',
      dataId: 'pre-3',
    }).expect(200);
    expect(retry.body.result).toBe('processed');
    // Still authorized: a refresh of an active subscription is not a new activation.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(premiumWelcomes()).toHaveLength(1);
  });

  it('ignores unknown resources and notification types', async () => {
    const unknown = await webhook(ctx, {
      id: 'evt-5',
      type: 'subscription_preapproval',
      dataId: 'missing',
    }).expect(200);
    expect(unknown.body.result).toBe('ignored');
    const otherType = await webhook(ctx, {
      id: 'evt-6',
      type: 'merchant_order',
      dataId: '1',
    }).expect(200);
    expect(otherType.body.result).toBe('ignored');
  });

  it('cancels in the provider and keeps Premium until the period ends', async () => {
    const response = await request(ctx.server)
      .post('/billing/subscription/cancel')
      .set(fan)
      .expect(200);

    expect(preapproval.cancelled).toEqual([`fake-${subscriptionId}`]);
    expect(response.body).toMatchObject({
      plan: 'premium',
      subscription: { status: 'cancelled' },
    });
    expect(response.body.subscription.cancelledAt).not.toBeNull();
  });

  it('returns 404 when there is nothing to cancel', async () => {
    const response = await request(ctx.server)
      .post('/billing/subscription/cancel')
      .set(fan)
      .expect(404);
    expect(response.body.code).toBe('SUBSCRIPTION_NOT_FOUND');
  });

  it('allows a new checkout after cancelling', async () => {
    await request(ctx.server).post('/billing/checkout').set(fan).expect(200);
    expect((await status()).subscription?.status).toBe('pending');
  });

  it('reads a pending checkout from the provider when the webhook is late', async () => {
    const pending = (await status()).subscription;
    const until = new Date(Date.now() + 30 * DAY_MS);
    preapproval.synced.set(`fake-${pending?.id ?? ''}`, {
      subscriptionId: pending?.id ?? '',
      status: SubscriptionStatus.Authorized,
      period: { kind: 'set', until },
    });

    expect(await status()).toMatchObject({
      plan: 'premium',
      subscription: { status: 'authorized', currentPeriodEnd: until.toISOString() },
    });
    // A new subscription that becomes active gets its own welcome, once.
    await vi.waitFor(() => expect(premiumWelcomes()).toHaveLength(2));
    await status();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(premiumWelcomes()).toHaveLength(2);
  });
});
