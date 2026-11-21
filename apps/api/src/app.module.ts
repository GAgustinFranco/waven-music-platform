import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import {
  type EnvironmentVariables,
  isAuthBypassEnabled,
  NodeEnv,
  validateEnv,
} from './config/env.validation.js';
import { buildLoggerParams } from './config/logger.config.js';
import { baseDatabaseOptions } from './database/database.options.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { StreamingModule } from './modules/streaming/streaming.module.js';
import { TestAuthModule } from './modules/auth/test-auth/test-auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { HistoryModule } from './modules/history/history.module.js';
import { UsersModule } from './modules/users/users.module.js';

type AppConfigService = ConfigService<EnvironmentVariables, true>;

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
      useFactory: (config: AppConfigService) =>
        buildLoggerParams({
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }),
        }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        // Test suites share one IP and would trip the strict auth limit.
        skipIf: () => config.get('NODE_ENV', { infer: true }) === NodeEnv.Test,
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        ...baseDatabaseOptions(config.get('DATABASE_URL', { infer: true })),
        autoLoadEntities: true,
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    StorageModule,
    CatalogModule,
    StreamingModule,
    HistoryModule,
    // The test login route exists only in e2e runs (see docs/ARCHITECTURE.md §5).
    ConditionalModule.registerWhen(TestAuthModule, (env) => isAuthBypassEnabled(validateEnv(env))),
  ],
  providers: [
    // Global guards run in this order.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
