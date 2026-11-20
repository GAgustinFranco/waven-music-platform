import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('Health and HTTP setup (e2e)', () => {
  let app: NestExpressApplication;
  let server: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health reports the API and the database as up', async () => {
    const response = await request(server).get('/health').expect(200);

    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(response.body.uptime).toEqual(expect.any(Number));
  });

  it('sets security headers', async () => {
    const response = await request(server).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns errors as { statusCode, code, message }', async () => {
    const response = await request(server).get('/does-not-exist').expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.any(String),
    });
  });

  it('serves the OpenAPI document', async () => {
    const response = await request(server).get('/docs-json').expect(200);

    expect(response.body.info.title).toBe('Waven API');
    expect(response.body.paths).toHaveProperty('/health');
  });
});
