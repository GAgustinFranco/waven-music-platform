import request from 'supertest';
import {
  createTestApp,
  getCookie,
  getSetCookie,
  refresh,
  resetDatabase,
  type TestApp,
  testLogin,
  TRUSTED_HEADERS,
} from './utils.js';

describe('Auth, profile and roles (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  describe('session cookies', () => {
    it('sets an httpOnly refresh cookie scoped to /api/auth and a session indicator', async () => {
      const response = await request(ctx.server)
        .post('/auth/test-login')
        .send({ email: 'fan@waven.test' })
        .expect(200);

      const refreshCookie = getSetCookie(response, 'waven_refresh');
      expect(refreshCookie).toMatch(/HttpOnly/i);
      expect(refreshCookie).toMatch(/Path=\/api\/auth/);
      expect(refreshCookie).toMatch(/SameSite=Lax/i);
      const sessionCookie = getSetCookie(response, 'waven_session');
      expect(sessionCookie).toMatch(/Path=\//);
      expect(sessionCookie).not.toMatch(/HttpOnly/i);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates the refresh token and returns a working access token', async () => {
      const { refreshToken } = await testLogin(ctx.server, { email: 'fan@waven.test' });

      const response = await refresh(ctx.server, refreshToken).expect(200);

      expect(response.body).toEqual({ accessToken: expect.any(String), expiresIn: 900 });
      const rotated = getCookie(response, 'waven_refresh');
      expect(rotated).toBeDefined();
      expect(rotated).not.toBe(refreshToken);

      await request(ctx.server)
        .get('/me')
        .auth(response.body.accessToken as string, { type: 'bearer' })
        .expect(200);
    });

    it('revokes the whole family when a rotated token is reused', async () => {
      const { refreshToken: first } = await testLogin(ctx.server, { email: 'fan@waven.test' });
      const second = getCookie(await refresh(ctx.server, first).expect(200), 'waven_refresh');
      expect(second).toBeDefined();

      // An attacker replays the stolen first token…
      const reuse = await refresh(ctx.server, first).expect(401);
      expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');
      expect(getSetCookie(reuse, 'waven_refresh')).toMatch(/Expires=Thu, 01 Jan 1970/);

      // …so the legitimate, newer token stops working too.
      const victim = await refresh(ctx.server, second ?? '').expect(401);
      expect(victim.body.code).toBe('REFRESH_TOKEN_REUSED');
    });

    it('keeps other sessions of the same user alive', async () => {
      const laptop = await testLogin(ctx.server, { email: 'fan@waven.test' });
      const phone = await testLogin(ctx.server, { email: 'fan@waven.test' });

      await refresh(ctx.server, laptop.refreshToken).expect(200);
      await refresh(ctx.server, laptop.refreshToken).expect(401);

      await refresh(ctx.server, phone.refreshToken).expect(200);
    });

    it('returns 401 without a cookie', async () => {
      const response = await request(ctx.server)
        .post('/auth/refresh')
        .set(TRUSTED_HEADERS)
        .expect(401);
      expect(response.body.code).toBe('NO_SESSION');
    });

    it('returns 401 with an unknown token', async () => {
      const response = await refresh(ctx.server, 'not-a-real-token').expect(401);
      expect(response.body.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it.each([
      ['without X-Requested-With', { Origin: 'http://localhost:3000' }],
      ['from another origin', { Origin: 'https://evil.example.com', 'X-Requested-With': 'x' }],
    ])('returns 403 %s', async (_label, headers) => {
      const { refreshToken } = await testLogin(ctx.server, { email: 'fan@waven.test' });

      const response = await request(ctx.server)
        .post('/auth/refresh')
        .set(headers)
        .set('Cookie', `waven_refresh=${refreshToken}`)
        .expect(403);
      expect(response.body.code).toBe('CSRF_CHECK_FAILED');
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session and clears the cookies', async () => {
      const { refreshToken } = await testLogin(ctx.server, { email: 'fan@waven.test' });

      const response = await request(ctx.server)
        .post('/auth/logout')
        .set(TRUSTED_HEADERS)
        .set('Cookie', `waven_refresh=${refreshToken}`)
        .expect(204);

      expect(getSetCookie(response, 'waven_session')).toMatch(/Expires=Thu, 01 Jan 1970/);
      await refresh(ctx.server, refreshToken).expect(401);
    });
  });

  describe('GET /auth/google', () => {
    it('redirects to Google with a state bound to a cookie', async () => {
      const response = await request(ctx.server).get('/auth/google').expect(302);

      const location = new URL(response.headers['location'] as string);
      expect(location.hostname).toBe('accounts.google.com');
      expect(location.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/api/auth/google/callback',
      );
      expect(location.searchParams.get('state')).toBe(getCookie(response, 'waven_oauth_state'));
    });

    it('sends a callback with a forged state back to the login page', async () => {
      const response = await request(ctx.server)
        .get('/auth/google/callback?code=abc&state=forged')
        .set('Cookie', 'waven_oauth_state=expected')
        .expect(302);

      expect(response.headers['location']).toBe('http://localhost:3000/login?error=oauth_failed');
    });
  });

  describe('/me', () => {
    it('requires an access token', async () => {
      const response = await request(ctx.server).get('/me').expect(401);
      expect(response.body).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
    });

    it('rejects an invalid access token', async () => {
      const response = await request(ctx.server)
        .get('/me')
        .auth('nope', { type: 'bearer' })
        .expect(401);
      expect(response.body.code).toBe('INVALID_ACCESS_TOKEN');
    });

    it('returns the profile with the plan and its limits', async () => {
      const { accessToken } = await testLogin(ctx.server, {
        email: 'Fan@Waven.test',
        displayName: 'Fan',
      });

      const response = await request(ctx.server)
        .get('/me')
        .auth(accessToken, { type: 'bearer' })
        .expect(200);

      expect(response.body).toMatchObject({
        email: 'fan@waven.test',
        displayName: 'Fan',
        role: 'user',
        plan: 'free',
        limits: { maxPlaylists: 5, streamQuality: 'high', themes: false },
      });
    });

    it('updates the display name', async () => {
      const { accessToken } = await testLogin(ctx.server, { email: 'fan@waven.test' });

      const response = await request(ctx.server)
        .patch('/me')
        .auth(accessToken, { type: 'bearer' })
        .send({ displayName: '  New name  ' })
        .expect(200);

      expect(response.body.displayName).toBe('New name');
    });

    it.each([[{ displayName: '' }], [{ displayName: 'x'.repeat(51) }], [{ role: 'admin' }]])(
      'rejects an invalid update %o',
      async (body) => {
        const { accessToken } = await testLogin(ctx.server, { email: 'fan@waven.test' });

        const response = await request(ctx.server)
          .patch('/me')
          .auth(accessToken, { type: 'bearer' })
          .send(body)
          .expect(400);
        expect(response.body.code).toBe('VALIDATION_FAILED');
      },
    );
  });

  describe('admin endpoints', () => {
    it('return 403 to a regular user', async () => {
      const { accessToken } = await testLogin(ctx.server, { email: 'fan@waven.test' });

      const response = await request(ctx.server)
        .get('/admin/users')
        .auth(accessToken, { type: 'bearer' })
        .expect(403);
      expect(response.body).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('work for a user listed in ADMIN_EMAILS', async () => {
      await testLogin(ctx.server, { email: 'fan@waven.test' });
      const { accessToken } = await testLogin(ctx.server, { email: 'admin@waven.test' });

      const response = await request(ctx.server)
        .get('/admin/users?limit=10')
        .auth(accessToken, { type: 'bearer' })
        .expect(200);

      expect(response.body).toMatchObject({ total: 2, limit: 10, offset: 0 });
      expect(response.body.items).toHaveLength(2);
    });

    it('validate pagination', async () => {
      const { accessToken } = await testLogin(ctx.server, { email: 'admin@waven.test' });

      await request(ctx.server)
        .get('/admin/users?limit=500')
        .auth(accessToken, { type: 'bearer' })
        .expect(400);
    });
  });
});
