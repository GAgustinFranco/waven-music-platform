import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    testTimeout: 30_000,
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
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: join(tmpdir(), 'waven-e2e-storage'),
      MEDIA_PUBLIC_URL: 'http://localhost:3000/api/media',
      STREAM_BASE_URL: 'http://localhost:3000/api',
      STREAM_TOKEN_SECRET: 'test-stream-secret-that-is-at-least-32-chars',
      STREAM_TOKEN_TTL: '3600',
      MEDIA_CONCURRENCY: '2',
      PAYMENT_MODE: 'preapproval',
      MP_ACCESS_TOKEN: '',
      MP_WEBHOOK_SECRET: 'test-webhook-secret',
      MP_PUBLIC_URL: 'https://tunnel.waven.test',
      MP_TEST_PAYER_EMAIL: '',
      MAIL_DRIVER: 'memory',
      MAIL_FROM: 'Waven <no-reply@waven.test>',
      RESEND_API_KEY: '',
    },
  },
});
