import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['reflect-metadata'],
    globalSetup: ['./test/global-setup.ts'],
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Suites share one database, so they run one file at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Local defaults for the `db-test` container; CI overrides them. Every
    // variable is set here so a developer's .env never leaks into the tests.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgres://waven:waven@localhost:5433/waven_test',
      WEB_URL: 'http://localhost:3000',
      CORS_ORIGINS: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/auth/google/callback',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-at-least-32-chars',
      JWT_ACCESS_TTL: '900',
      REFRESH_TTL_DAYS: '30',
      ADMIN_EMAILS: 'admin@waven.test',
      E2E_AUTH_BYPASS: 'true',
    },
  },
});
