import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { type Response } from 'express';
import { type EnvironmentVariables } from '../../../config/env.validation.js';
import { GOOGLE_STRATEGY } from './google.strategy.js';

export class OAuthFailedException extends UnauthorizedException {
  constructor() {
    super({ code: 'OAUTH_FAILED', message: 'Google sign-in failed' });
  }
}

/** Runs the Google strategy: redirects to Google, then handles the callback. */
@Injectable()
export class GoogleAuthGuard extends AuthGuard(GOOGLE_STRATEGY) {
  override handleRequest<TUser = unknown>(err: unknown, user: TUser | false): TUser {
    if (err || !user) {
      throw new OAuthFailedException();
    }
    return user;
  }
}

/** On the callback, a failed sign-in sends the browser back to the login page. */
@Catch(OAuthFailedException)
@Injectable()
export class OAuthFailureFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  catch(_exception: OAuthFailedException, host: ArgumentsHost): void {
    const webUrl = this.config.get('WEB_URL', { infer: true });
    host.switchToHttp().getResponse<Response>().redirect(302, `${webUrl}/login?error=oauth_failed`);
  }
}
