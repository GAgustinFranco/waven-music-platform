import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { MailService } from '../mail/mail.service.js';
import { welcomeEmail } from '../mail/mail.templates.js';
import { NotificationType } from '../notifications/notification.entity.js';
import { dedupKeys, NotificationsService } from '../notifications/notifications.service.js';
import { type User } from '../users/user.entity.js';
import { type ExternalProfile, UsersService } from '../users/users.service.js';
import { type AccessTokenPayload } from './auth.types.js';
import {
  createVerificationToken,
  hashVerificationToken,
  verificationUrl,
} from './email-verification.js';
import { PasswordHasher } from './password/password-hasher.js';
import { type IssuedRefreshToken, RefreshTokenService } from './refresh-token.service.js';

export interface AccessToken {
  accessToken: string;
  expiresIn: number;
}

export interface Session {
  user: User;
  refresh: IssuedRefreshToken;
}

export interface Registration {
  email: string;
  password: string;
  displayName: string;
}

/** The same answer for an unknown email, a wrong password and a Google-only account. */
const invalidCredentials = () =>
  new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  });

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly passwords: PasswordHasher,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Signs in (or up) a user coming back from an identity provider. */
  async login(
    profile: ExternalProfile,
    userAgent: string | null,
    options: { grantAdmin?: boolean } = {},
  ): Promise<Session> {
    const grantAdmin = options.grantAdmin === true || this.isAdminEmail(profile.email);
    const { user, passwordRemoved, created } = await this.users.upsertFromProvider(profile, {
      grantAdmin,
    });
    if (passwordRemoved) {
      // Sessions opened with the removed password belong to whoever set it.
      await this.refreshTokens.revokeAllForUser(user.id);
    }
    if (created) {
      // Google already verified the email, so there is no link to click.
      void this.mail.send(user.email, 'welcome', welcomeEmail({ displayName: user.displayName }));
      await this.notifyWelcome(user);
    }
    return this.startSession(user, userAgent);
  }

  /** Creates a password account and signs it in; 409 `EMAIL_IN_USE` if the email exists. */
  async register(input: Registration, userAgent: string | null): Promise<Session> {
    const { token, ...emailVerification } = createVerificationToken();
    const user = await this.users.createWithPassword(
      {
        email: input.email,
        displayName: input.displayName,
        passwordHash: await this.passwords.hash(input.password),
        emailVerification,
      },
      { grantAdmin: this.isAdminEmail(input.email) },
    );
    void this.mail.send(
      user.email,
      'welcome',
      welcomeEmail({
        displayName: user.displayName,
        verifyUrl: verificationUrl(this.config.get('WEB_URL', { infer: true }), token),
      }),
    );
    await this.notifyWelcome(user);
    return this.startSession(user, userAgent);
  }

  /** One-click verification; 400 `EMAIL_VERIFICATION_INVALID` if unknown, used or expired. */
  async verifyEmail(token: string): Promise<void> {
    if (!(await this.users.verifyEmail(hashVerificationToken(token)))) {
      throw new BadRequestException({
        code: 'EMAIL_VERIFICATION_INVALID',
        message: 'This verification link is invalid or has expired',
      });
    }
  }

  /** 401 `INVALID_CREDENTIALS` without saying which part was wrong. */
  async loginWithPassword(
    credentials: { email: string; password: string },
    userAgent: string | null,
  ): Promise<Session> {
    const found = await this.users.findByEmail(credentials.email);
    const valid = found?.passwordHash
      ? await this.passwords.verify(credentials.password, found.passwordHash)
      : await this.passwords.verifyDummy(credentials.password);
    if (!found || !valid) {
      throw invalidCredentials();
    }
    const user = this.isAdminEmail(found.email) ? await this.users.grantAdmin(found) : found;
    return this.startSession(user, userAgent);
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

  private isAdminEmail(email: string): boolean {
    return this.config.get('ADMIN_EMAILS', { infer: true }).includes(email.toLowerCase());
  }

  /**
   * The in-app twin of the welcome email. Like the email it never fails the
   * sign-up: the account already exists, so a failure here only logs.
   */
  private async notifyWelcome(user: User): Promise<void> {
    try {
      await this.notifications.notify({
        userId: user.id,
        type: NotificationType.Welcome,
        dedupKey: dedupKeys.welcome(),
      });
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error', userId: user.id },
        'Welcome notification could not be stored',
      );
    }
  }

  private async startSession(user: User, userAgent: string | null): Promise<Session> {
    const refresh = await this.refreshTokens.issue(user.id, userAgent);
    return { user, refresh };
  }
}
