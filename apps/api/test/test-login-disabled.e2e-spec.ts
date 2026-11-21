import request from 'supertest';
import { createTestApp, type TestApp } from './utils.js';

// Vitest isolates each file, so changing the env before the app module is
// imported boots the API exactly as it would run in production.
describe('Test login route outside e2e runs', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'production';
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('does not exist in production even with E2E_AUTH_BYPASS=true', async () => {
    expect(process.env['E2E_AUTH_BYPASS']).toBe('true');

    const response = await request(ctx.server)
      .post('/auth/test-login')
      .send({ email: 'intruder@waven.test', admin: true })
      .expect(404);

    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('is not in the OpenAPI document', async () => {
    const response = await request(ctx.server).get('/docs-json').expect(200);
    expect(Object.keys(response.body.paths as object)).not.toContain('/auth/test-login');
  });
});
