import request from 'supertest';
import { type App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
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

const PASSWORD = 'correct horse battery';

function register(
  server: App,
  body: Record<string, unknown> = {
    email: 'fan@waven.test',
    password: PASSWORD,
    displayName: 'Fan',
  },
) {
  return request(server).post('/auth/register').set(TRUSTED_HEADERS).send(body);
}

function login(server: App, email: string, password: string) {
  return request(server).post('/auth/login').set(TRUSTED_HEADERS).send({ email, password });
}

describe('Email and password auth (e2e)', () => {
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

  const me = (accessToken: string) =>
    request(ctx.server).get('/me').auth(accessToken, { type: 'bearer' });

  describe('POST /auth/register', () => {
    it('creates the account, starts a session and stores only a hash', async () => {
      const response = await register(ctx.server, {
        email: '  Fan@Waven.TEST ',
        password: PASSWORD,
        displayName: '  Fan  ',
      }).expect(201);

      expect(response.body).toMatchObject({ expiresIn: 900 });
      expect(getSetCookie(response, 'waven_refresh')).toContain('HttpOnly');
      expect(getCookie(response, 'waven_session')).toBe('1');

      const profile = await me(response.body.accessToken as string).expect(200);
      expect(profile.body).toMatchObject({
        email: 'fan@waven.test',
        displayName: 'Fan',
        role: 'user',
        plan: 'free',
      });
      expect(profile.body).not.toHaveProperty('passwordHash');

      const [row] = (await ctx.app
        .get(DataSource)
        .query(`SELECT "google_id", "password_hash" FROM "users"`)) as {
        google_id: string | null;
        password_hash: string;
      }[];
      expect(row?.google_id).toBeNull();
      expect(row?.password_hash).toMatch(/^scrypt\$/);
      expect(row?.password_hash).not.toContain(PASSWORD);
    });

    it('opens a session that refreshes like any other', async () => {
      const response = await register(ctx.server).expect(201);
      const token = getCookie(response, 'waven_refresh');

      await refresh(ctx.server, token ?? '').expect(200);
    });

    it('returns 409 EMAIL_IN_USE for an email that already has a password account', async () => {
      await register(ctx.server).expect(201);

      const response = await register(ctx.server, {
        email: 'FAN@waven.test',
        password: 'another password',
        displayName: 'Copycat',
      }).expect(409);

      expect(response.body).toMatchObject({ statusCode: 409, code: 'EMAIL_IN_USE' });
      expect(getCookie(response, 'waven_refresh')).toBeUndefined();
    });

    it('returns 409 for an email that belongs to a Google account, and leaves it alone', async () => {
      const google = await testLogin(ctx.server, { email: 'fan@waven.test' });

      await register(ctx.server).expect(409);

      await refresh(ctx.server, google.refreshToken).expect(200);
      await login(ctx.server, 'fan@waven.test', PASSWORD).expect(401);
    });

    it.each([
      ['a short password', { email: 'fan@waven.test', password: 'short', displayName: 'Fan' }],
      [
        'a password over 128 characters',
        { email: 'fan@waven.test', password: 'x'.repeat(129), displayName: 'Fan' },
      ],
      ['an invalid email', { email: 'not-an-email', password: PASSWORD, displayName: 'Fan' }],
      ['a blank display name', { email: 'fan@waven.test', password: PASSWORD, displayName: ' ' }],
      [
        'unknown fields',
        { email: 'fan@waven.test', password: PASSWORD, displayName: 'Fan', role: 'admin' },
      ],
    ])('rejects %s with 400', async (_case, body) => {
      await register(ctx.server, body).expect(400);
    });

    it('grants admin to emails listed in ADMIN_EMAILS', async () => {
      const response = await register(ctx.server, {
        email: 'admin@waven.test',
        password: PASSWORD,
        displayName: 'Admin',
      }).expect(201);

      await request(ctx.server)
        .get('/admin/users')
        .auth(response.body.accessToken as string, { type: 'bearer' })
        .expect(200);
    });

    it('requires the CSRF header and the web origin', async () => {
      const body = { email: 'fan@waven.test', password: PASSWORD, displayName: 'Fan' };

      await request(ctx.server)
        .post('/auth/register')
        .set('Origin', 'https://evil.example.com')
        .set('X-Requested-With', 'fetch')
        .send(body)
        .expect(403);
      await request(ctx.server)
        .post('/auth/register')
        .set('Origin', TRUSTED_HEADERS.Origin)
        .send(body)
        .expect(403);
    });
  });

  describe('POST /auth/login', () => {
    it('signs in with the right password, whatever the email case', async () => {
      await register(ctx.server).expect(201);

      const response = await login(ctx.server, 'FAN@waven.test', PASSWORD).expect(200);

      expect(getSetCookie(response, 'waven_refresh')).toContain('Path=/api/auth');
      await me(response.body.accessToken as string).expect(200);
    });

    it.each([
      ['a wrong password', 'fan@waven.test', 'wrong password'],
      ['an unknown email', 'ghost@waven.test', PASSWORD],
    ])('answers 401 INVALID_CREDENTIALS for %s', async (_case, email, password) => {
      await register(ctx.server).expect(201);

      const response = await login(ctx.server, email, password).expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      expect(getCookie(response, 'waven_refresh')).toBeUndefined();
    });

    it('answers the same 401 for a Google-only account', async () => {
      await testLogin(ctx.server, { email: 'fan@waven.test' });

      const response = await login(ctx.server, 'fan@waven.test', PASSWORD).expect(401);

      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('grants admin to an email added to ADMIN_EMAILS after sign-up', async () => {
      await register(ctx.server, {
        email: 'admin@waven.test',
        password: PASSWORD,
        displayName: 'Admin',
      }).expect(201);
      await ctx.app.get(DataSource).query(`UPDATE "users" SET "role" = 'user'`);

      const response = await login(ctx.server, 'admin@waven.test', PASSWORD).expect(200);

      await request(ctx.server)
        .get('/admin/users')
        .auth(response.body.accessToken as string, { type: 'bearer' })
        .expect(200);
    });

    it('requires the CSRF header', async () => {
      await request(ctx.server)
        .post('/auth/login')
        .set('Origin', TRUSTED_HEADERS.Origin)
        .send({ email: 'fan@waven.test', password: PASSWORD })
        .expect(403);
    });
  });

  describe('Google sign-in with the email of a password account', () => {
    it('takes the account over, removes the password and ends its sessions', async () => {
      const squatter = await register(ctx.server).expect(201);
      const squatterRefresh = getCookie(squatter, 'waven_refresh') ?? '';

      const owner = await testLogin(ctx.server, { email: 'fan@waven.test' });

      await refresh(ctx.server, squatterRefresh).expect(401);
      await login(ctx.server, 'fan@waven.test', PASSWORD).expect(401);
      await refresh(ctx.server, owner.refreshToken).expect(200);

      const rows = (await ctx.app
        .get(DataSource)
        .query(`SELECT "google_id", "password_hash" FROM "users"`)) as unknown[];
      expect(rows).toEqual([{ google_id: 'test:fan@waven.test', password_hash: null }]);
    });
  });

  it('rejects a user without any way to sign in at the database level', async () => {
    await expect(
      ctx.app
        .get(DataSource)
        .query(
          `INSERT INTO "users" ("email", "display_name") VALUES ('nobody@waven.test', 'Nobody')`,
        ),
    ).rejects.toThrow(/CHK_users_has_credential/);
  });
});
