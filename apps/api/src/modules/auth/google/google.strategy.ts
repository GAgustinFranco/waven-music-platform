import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { type Profile, Strategy, type StrategyOptions } from 'passport-google-oauth20';
import { type EnvironmentVariables } from '../../../config/env.validation.js';
import { type ExternalProfile } from '../../users/users.service.js';
import { OAuthStateStore } from './oauth-state.store.js';

export const GOOGLE_STRATEGY = 'google';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, GOOGLE_STRATEGY) {
  constructor(config: ConfigService<EnvironmentVariables, true>, stateStore: OAuthStateStore) {
    const options: StrategyOptions = {
      clientID: config.get('GOOGLE_CLIENT_ID', { infer: true }),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      callbackURL: config.get('GOOGLE_CALLBACK_URL', { infer: true }),
      scope: ['openid', 'email', 'profile'],
      store: stateStore,
    };
    super(options);
  }

  /** Passport stores the return value in `req.user` for the callback route. */
  validate(_accessToken: string, _refreshToken: string, profile: Profile): ExternalProfile {
    const email = profile.emails?.find((entry) => entry.verified)?.value;
    if (!email) {
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Your Google account has no verified email',
      });
    }

    return {
      googleId: profile.id,
      email,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
  }
}
