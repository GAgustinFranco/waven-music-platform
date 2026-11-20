import { NodeEnv, validateEnv } from './env.validation.js';

const DATABASE_URL = 'postgres://waven:waven@localhost:5432/waven';

describe('validateEnv', () => {
  it('applies defaults when only the required variables are set', () => {
    const env = validateEnv({ DATABASE_URL });

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('parses numbers and comma-separated lists', () => {
    const env = validateEnv({
      DATABASE_URL,
      PORT: '8080',
      CORS_ORIGINS: 'http://localhost:3000, https://waven.example.com',
    });

    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://waven.example.com']);
  });

  it('fails when a required variable is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['DATABASE_URL', 'mysql://localhost/waven'],
    ['PORT', 'not-a-number'],
    ['PORT', '70000'],
    ['NODE_ENV', 'staging'],
    ['LOG_LEVEL', 'verbose'],
    ['CORS_ORIGINS', 'not a url'],
  ])('fails when %s is invalid (%s)', (key, value) => {
    expect(() => validateEnv({ DATABASE_URL, [key]: value })).toThrow(new RegExp(key));
  });
});
