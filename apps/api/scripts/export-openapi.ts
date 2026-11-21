import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';

/**
 * Writes `apps/api/openapi.json`, the contract the web client is generated from.
 * The output must not depend on the developer's environment, so every variable
 * is fixed here, and preview mode builds the module graph without connecting to
 * the database.
 */
const FIXED_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://openapi:openapi@localhost:5432/openapi',
  GOOGLE_CLIENT_ID: 'openapi',
  GOOGLE_CLIENT_SECRET: 'openapi',
  JWT_ACCESS_SECRET: 'openapi-export-placeholder-secret-0000',
  E2E_AUTH_BYPASS: 'false',
  STORAGE_DRIVER: 'local',
  STREAM_TOKEN_SECRET: 'openapi-export-placeholder-secret-0000',
};
Object.assign(process.env, FIXED_ENV);

const { AppModule } = await import('../src/app.module.js');
const { buildOpenApiConfig } = await import('../src/app.setup.js');

const app = await NestFactory.create<NestExpressApplication>(AppModule, {
  preview: true,
  logger: false,
  abortOnError: false,
});
const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
const output = resolve(import.meta.dirname, '../../openapi.json');
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
await app.close();

console.log(`OpenAPI document written to ${output}`);
