import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { type EnvironmentVariables, validateEnv } from './config/env.validation.js';
import { buildLoggerParams } from './config/logger.config.js';
import { baseDatabaseOptions } from './database/database.options.js';
import { HealthModule } from './modules/health/health.module.js';

type AppConfigService = ConfigService<EnvironmentVariables, true>;

const getEnv = (config: AppConfigService): EnvironmentVariables => ({
  NODE_ENV: config.get('NODE_ENV', { infer: true }),
  PORT: config.get('PORT', { infer: true }),
  DATABASE_URL: config.get('DATABASE_URL', { infer: true }),
  LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
  CORS_ORIGINS: config.get('CORS_ORIGINS', { infer: true }),
});

@Module({
  imports: [
    // apps/api/.env wins over the repository root .env; real env vars win over both.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => buildLoggerParams(getEnv(config)),
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        ...baseDatabaseOptions(config.get('DATABASE_URL', { infer: true })),
        autoLoadEntities: true,
      }),
    }),
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
