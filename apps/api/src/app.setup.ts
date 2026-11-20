import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { type EnvironmentVariables } from './config/env.validation.js';

/** Applies the HTTP setup shared by `main.ts` and the e2e tests. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // The API sits behind the web proxy (and Render's proxy in production).
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }) });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, buildOpenApiConfig()));
}

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('Waven API')
    .setDescription('Music streaming API')
    .setVersion('0.1.0')
    .build();
}
