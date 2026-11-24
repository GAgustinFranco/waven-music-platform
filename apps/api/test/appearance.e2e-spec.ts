import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp, resetDatabase, type TestApp, testLogin } from './utils.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Appearance (e2e)', () => {
  let ctx: TestApp;
  let fan: { Authorization: string };
  let fanId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.app);
    const login = await testLogin(ctx.server, { email: 'themes@waven.test' });
    fan = { Authorization: `Bearer ${login.accessToken}` };
    fanId = (await request(ctx.server).get('/me').set(fan).expect(200)).body.id as string;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  /** Gives the user an authorized subscription (business rule 1), or ends it. */
  async function setPremium(on: boolean): Promise<void> {
    const db = ctx.app.get(DataSource);
    await db.query('DELETE FROM subscriptions WHERE user_id = $1', [fanId]);
    if (on) {
      await db.query(
        `INSERT INTO subscriptions (user_id, provider, mode, status, amount, currency, current_period_end)
         VALUES ($1, 'mercadopago', 'preapproval', 'authorized', 2999, 'ARS', $2)`,
        [fanId, new Date(Date.now() + 30 * DAY_MS)],
      );
    }
  }

  it('starts with the default appearance', async () => {
    const me = await request(ctx.server).get('/me').set(fan).expect(200);
    expect(me.body.appearance).toEqual({ theme: 'violet', backdrop: 'solid' });
  });

  it('refuses a theme on the Free plan with 403 PREMIUM_REQUIRED', async () => {
    const response = await request(ctx.server)
      .patch('/me')
      .set(fan)
      .send({ theme: 'ocean', backdrop: 'glow' })
      .expect(403);
    expect(response.body.code).toBe('PREMIUM_REQUIRED');
  });

  it('rejects an unknown theme', async () => {
    await request(ctx.server).patch('/me').set(fan).send({ theme: 'neon' }).expect(400);
  });

  it('saves the theme for a Premium user', async () => {
    await setPremium(true);

    const response = await request(ctx.server)
      .patch('/me')
      .set(fan)
      .send({ theme: 'dynamic', backdrop: 'glow' })
      .expect(200);

    expect(response.body.appearance).toEqual({ theme: 'dynamic', backdrop: 'glow' });
  });

  it('saves the Ambient backdrop for a Premium user', async () => {
    const response = await request(ctx.server)
      .patch('/me')
      .set(fan)
      .send({ backdrop: 'ambient' })
      .expect(200);
    expect(response.body.appearance).toEqual({ theme: 'dynamic', backdrop: 'ambient' });

    await request(ctx.server).patch('/me').set(fan).send({ backdrop: 'glow' }).expect(200);
  });

  it('shows the default after going back to Free but keeps the saved choice', async () => {
    await setPremium(false);

    const me = await request(ctx.server).get('/me').set(fan).expect(200);

    expect(me.body).toMatchObject({
      plan: 'free',
      appearance: { theme: 'violet', backdrop: 'solid' },
      savedAppearance: { theme: 'dynamic', backdrop: 'glow' },
    });
  });

  it('lets a Free user rename without touching the saved theme', async () => {
    const response = await request(ctx.server)
      .patch('/me')
      .set(fan)
      .send({ displayName: 'Theme Fan' })
      .expect(200);

    expect(response.body.savedAppearance.theme).toBe('dynamic');
  });
});
