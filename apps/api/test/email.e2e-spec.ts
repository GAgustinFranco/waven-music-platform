import request from 'supertest';
import { DataSource } from 'typeorm';
import { MAIL_DRIVER } from '../src/modules/mail/mail.types.js';
import { type MemoryMailDriver } from '../src/modules/mail/memory-mail.driver.js';
import { createTestApp, resetDatabase, type TestApp, testLogin, TRUSTED_HEADERS } from './utils.js';

const EMAIL = 'fan@waven.test';

describe('Welcome and verification emails (e2e)', () => {
  let ctx: TestApp;
  let mail: MemoryMailDriver;

  beforeAll(async () => {
    ctx = await createTestApp();
    mail = ctx.app.get<MemoryMailDriver>(MAIL_DRIVER);
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
    mail.clear();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  const register = () =>
    request(ctx.server)
      .post('/auth/register')
      .set(TRUSTED_HEADERS)
      .send({ email: EMAIL, password: 'correct horse battery', displayName: 'Fan' })
      .expect(201);

  const verify = (token: string) => request(ctx.server).post('/auth/verify-email').send({ token });

  const verifiedAt = async (email = EMAIL): Promise<Date | null> => {
    const rows: { email_verified_at: Date | null }[] = await ctx.app
      .get(DataSource)
      .query('SELECT "email_verified_at" FROM "users" WHERE "email" = $1', [email]);
    return rows[0]?.email_verified_at ?? null;
  };

  const tokenFromWelcome = (): string => {
    const [welcome] = mail.to(EMAIL);
    const url = /http:\/\/localhost:3000\/verify-email\?token=\S+/.exec(welcome?.text ?? '')?.[0];
    return new URL(url ?? 'http://invalid').searchParams.get('token') ?? '';
  };

  it('welcomes a password account with a link that verifies the email once', async () => {
    await register();

    const messages = mail.to(EMAIL);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.subject).toBe('Welcome to Waven');
    expect(messages[0]?.html).toContain('href="http://localhost:3000/verify-email?token=');
    expect(await verifiedAt()).toBeNull();

    const token = tokenFromWelcome();
    // Only the hash is stored, never the token itself.
    const [stored] = (await ctx.app
      .get(DataSource)
      .query('SELECT "email_verification_token_hash" AS "hash" FROM "users"')) as {
      hash: string;
    }[];
    expect(stored?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.hash).not.toBe(token);

    await verify(token).expect(204);
    expect(await verifiedAt()).toBeInstanceOf(Date);

    const reused = await verify(token).expect(400);
    expect(reused.body).toMatchObject({ statusCode: 400, code: 'EMAIL_VERIFICATION_INVALID' });
  });

  it('rejects an expired link', async () => {
    await register();
    await ctx.app
      .get(DataSource)
      .query(`UPDATE "users" SET "email_verification_expires_at" = now() - interval '1 minute'`);

    const response = await verify(tokenFromWelcome()).expect(400);

    expect(response.body.code).toBe('EMAIL_VERIFICATION_INVALID');
    expect(await verifiedAt()).toBeNull();
  });

  it('rejects an unknown token and validates the body', async () => {
    const unknown = await verify('not-a-real-token').expect(400);
    expect(unknown.body.code).toBe('EMAIL_VERIFICATION_INVALID');

    const missing = await request(ctx.server).post('/auth/verify-email').send({}).expect(400);
    expect(missing.body.code).toBe('VALIDATION_FAILED');
  });

  it('welcomes a Google account once, without a link, and counts it as verified', async () => {
    await testLogin(ctx.server, { email: 'google@waven.test' });
    await testLogin(ctx.server, { email: 'google@waven.test' });

    const messages = mail.to('google@waven.test');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.subject).toBe('Welcome to Waven');
    expect(messages[0]?.text).not.toContain('verify-email');
    expect(await verifiedAt('google@waven.test')).toBeInstanceOf(Date);
  });

  it('verifies a password account that Google takes over', async () => {
    await register();

    await testLogin(ctx.server, { email: EMAIL });

    expect(await verifiedAt()).toBeInstanceOf(Date);
    // The old link no longer works: the token was cleared.
    await verify(tokenFromWelcome()).expect(400);
  });
});
