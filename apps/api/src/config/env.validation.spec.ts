import { isAuthBypassEnabled, NodeEnv, validateEnv } from './env.validation.js';

const REQUIRED = {
  DATABASE_URL: 'postgres://waven:waven@localhost:5432/waven',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  STREAM_TOKEN_SECRET: 'b'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults when only the required variables are set', () => {
    const env = validateEnv(REQUIRED);

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.JWT_ACCESS_TTL).toBe(900);
    expect(env.REFRESH_TTL_DAYS).toBe(30);
    expect(env.ADMIN_EMAILS).toEqual([]);
    expect(env.E2E_AUTH_BYPASS).toBe(false);
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.STREAM_TOKEN_TTL).toBe(3600);
  });

  it('requires the bucket credentials only with the s3 driver', () => {
    expect(() => validateEnv({ ...REQUIRED, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
    const env = validateEnv({
      ...REQUIRED,
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'waven',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    expect(env.S3_BUCKET).toBe('waven');
  });

  it('logs emails by default and requires the Resend key only with that driver', () => {
    expect(validateEnv(REQUIRED).MAIL_DRIVER).toBe('log');
    expect(() => validateEnv({ ...REQUIRED, MAIL_DRIVER: 'resend' })).toThrow(/RESEND_API_KEY/);
    expect(() => validateEnv({ ...REQUIRED, MAIL_DRIVER: 'smtp' })).toThrow(/MAIL_DRIVER/);
    const env = validateEnv({ ...REQUIRED, MAIL_DRIVER: 'resend', RESEND_API_KEY: 're_x' });
    expect(env.RESEND_API_KEY).toBe('re_x');
  });

  it('parses numbers, booleans and comma-separated lists', () => {
    const env = validateEnv({
      ...REQUIRED,
      PORT: '8080',
      CORS_ORIGINS: 'http://localhost:3000, https://waven.example.com',
      ADMIN_EMAILS: 'Admin@Example.com, ops@example.com',
      E2E_AUTH_BYPASS: 'true',
    });

    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://waven.example.com']);
    expect(env.ADMIN_EMAILS).toEqual(['admin@example.com', 'ops@example.com']);
    expect(env.E2E_AUTH_BYPASS).toBe(true);
  });

  it.each(Object.keys(REQUIRED))('fails when %s is missing', (key) => {
    const config = Object.fromEntries(Object.entries(REQUIRED).filter(([name]) => name !== key));

    expect(() => validateEnv(config)).toThrow(new RegExp(key));
  });

  it.each([
    ['DATABASE_URL', 'mysql://localhost/waven'],
    ['PORT', 'not-a-number'],
    ['PORT', '70000'],
    ['NODE_ENV', 'staging'],
    ['LOG_LEVEL', 'verbose'],
    ['CORS_ORIGINS', 'not a url'],
    ['JWT_ACCESS_SECRET', 'too-short'],
    ['ADMIN_EMAILS', 'not-an-email'],
    ['STORAGE_DRIVER', 'ftp'],
    ['STREAM_TOKEN_SECRET', 'too-short'],
    ['MEDIA_CONCURRENCY', '0'],
  ])('fails when %s is invalid (%s)', (key, value) => {
    expect(() => validateEnv({ ...REQUIRED, [key]: value })).toThrow(new RegExp(key));
  });
});

describe('isAuthBypassEnabled', () => {
  it.each([
    [NodeEnv.Test, true, true],
    [NodeEnv.Test, false, false],
    [NodeEnv.Development, true, false],
    [NodeEnv.Production, true, false],
  ])('NODE_ENV=%s and E2E_AUTH_BYPASS=%s → %s', (NODE_ENV, E2E_AUTH_BYPASS, expected) => {
    expect(isAuthBypassEnabled({ NODE_ENV, E2E_AUTH_BYPASS })).toBe(expected);
  });
});
