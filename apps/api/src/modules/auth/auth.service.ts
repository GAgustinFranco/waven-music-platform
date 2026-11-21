import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { type User } from '../users/user.entity.js';
import { type ExternalProfile, UsersService } from '../users/users.service.js';
import { type AccessTokenPayload } from './auth.types.js';
import { type IssuedRefreshToken, RefreshTokenService } from './refresh-token.service.js';

export interface AccessToken {
  accessToken: string;
  expiresIn: number;
}

export interface Session {
  user: User;
  refresh: IssuedRefreshToken;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Signs in (or up) a user coming back from an identity provider. */
  async login(
    profile: ExternalProfile,
    userAgent: string | null,
    options: { grantAdmin?: boolean } = {},
  ): Promise<Session> {
    const adminEmails = this.config.get('ADMIN_EMAILS', { infer: true });
    const grantAdmin =
      options.grantAdmin === true || adminEmails.includes(profile.email.toLowerCase());
    const user = await this.users.upsertFromProvider(profile, { grantAdmin });
    const refresh = await this.refreshTokens.issue(user.id, userAgent);
    return { user, refresh };
  }

  async refresh(
    token: string,
    userAgent: string | null,
  ): Promise<AccessToken & { refresh: IssuedRefreshToken }> {
    const { user, ...refresh } = await this.refreshTokens.rotate(token, userAgent);
    return { ...(await this.signAccessToken(user)), refresh };
  }

  logout(token: string): Promise<void> {
    return this.refreshTokens.revoke(token);
  }

  async signAccessToken(user: Pick<User, 'id' | 'role'>): Promise<AccessToken> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    };
  }

  /**
   * CSRF defense for the cookie-authenticated routes: browsers only send a custom
   * header on same-origin requests, and `Origin` must be the web app.
   */
  assertTrustedOrigin(req: Request): void {
    const webOrigin = new URL(this.config.get('WEB_URL', { infer: true })).origin;
    if (!req.headers['x-requested-with'] || req.headers.origin !== webOrigin) {
      throw new ForbiddenException({
        code: 'CSRF_CHECK_FAILED',
        message: 'Untrusted request origin',
      });
    }
  }

  get secureCookies(): boolean {
    return this.config.get('WEB_URL', { infer: true }).startsWith('https:');
  }
}
