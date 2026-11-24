import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleAuthGuard, OAuthFailureFilter } from './google/google-auth.guard.js';
import { GoogleStrategy } from './google/google.strategy.js';
import { OAuthStateStore } from './google/oauth-state.store.js';
import { PasswordHasher } from './password/password-hasher.js';
import { RefreshToken } from './refresh-token.entity.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken]),
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_ACCESS_TTL', { infer: true }),
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    RefreshTokenService,
    GoogleStrategy,
    OAuthStateStore,
    GoogleAuthGuard,
    OAuthFailureFilter,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
