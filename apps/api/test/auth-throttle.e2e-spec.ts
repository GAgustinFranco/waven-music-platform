import request from 'supertest';
import { createTestApp, type TestApp, TRUSTED_HEADERS } from './utils.js';

// The throttler is skipped when NODE_ENV=test (every suite shares one IP). Vitest
// isolates each file, so booting this one as production turns it back on.
describe('Auth rate limiting (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'production';
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('allows 10 password logins per minute and answers 429 after that', async () => {
    const attempt = () =>
      request(ctx.server)
        .post('/auth/login')
        .set(TRUSTED_HEADERS)
        .send({ email: 'guess@waven.test', password: 'guess-password' });

    for (let i = 0; i < 10; i += 1) {
      await attempt().expect(401);
    }
    const response = await attempt().expect(429);

    expect(response.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' });
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('limits sign-ups the same way', async () => {
    const attempt = () =>
      request(ctx.server)
        .post('/auth/register')
        .set(TRUSTED_HEADERS)
        .send({ email: 'not-an-email', password: 'x', displayName: 'Bot' });

    for (let i = 0; i < 10; i += 1) {
      await attempt().expect(400);
    }
    await attempt().expect(429);
  });
});
