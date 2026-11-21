import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { type App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/app.setup.js';

export const WEB_ORIGIN = 'http://localhost:3000';

/** Headers the web client sends on cookie-authenticated auth routes. */
export const TRUSTED_HEADERS = { Origin: WEB_ORIGIN, 'X-Requested-With': 'fetch' };

export interface TestApp {
  app: NestExpressApplication;
  server: App;
}

/** Boots the real AppModule. Import it lazily so a test can tweak env vars first. */
export async function createTestApp(): Promise<TestApp> {
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, server: app.getHttpServer() as App };
}

export async function resetDatabase(app: NestExpressApplication): Promise<void> {
  await app.get(DataSource).query('TRUNCATE TABLE "refresh_tokens", "users" CASCADE');
}

/** Reads one cookie value from a response's `Set-Cookie` headers. */
export function getCookie(response: request.Response, name: string): string | undefined {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match?.slice(name.length + 1).split(';')[0];
}

export function getSetCookie(response: request.Response, name: string): string | undefined {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

export interface LoggedIn {
  accessToken: string;
  refreshToken: string;
}

export async function testLogin(
  server: App,
  body: { email: string; admin?: boolean; displayName?: string },
): Promise<LoggedIn> {
  const response = await request(server).post('/auth/test-login').send(body).expect(200);
  const refreshToken = getCookie(response, 'waven_refresh');
  if (!refreshToken) {
    throw new Error('test-login did not set the refresh cookie');
  }
  return { accessToken: (response.body as { accessToken: string }).accessToken, refreshToken };
}

export function refresh(server: App, refreshToken: string) {
  return request(server)
    .post('/auth/refresh')
    .set(TRUSTED_HEADERS)
    .set('Cookie', `waven_refresh=${refreshToken}`);
}
