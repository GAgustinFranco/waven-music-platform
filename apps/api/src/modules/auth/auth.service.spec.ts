import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { type MailService } from '../mail/mail.service.js';
import { NotificationType } from '../notifications/notification.entity.js';
import { type NotificationsService } from '../notifications/notifications.service.js';
import { Role, type User } from '../users/user.entity.js';
import { type UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { hashVerificationToken } from './email-verification.js';
import { type PasswordHasher } from './password/password-hasher.js';
import { type RefreshTokenService } from './refresh-token.service.js';

const env: Partial<EnvironmentVariables> = {
  ADMIN_EMAILS: ['boss@example.com'],
  JWT_ACCESS_TTL: 900,
  WEB_URL: 'http://localhost:3000',
};

function setup(
  options: { passwordRemoved?: boolean; created?: boolean; stored?: User | null } = {},
) {
  const users = {
    upsertFromProvider: vi.fn((profile: { email: string }, upsert: { grantAdmin: boolean }) =>
      Promise.resolve({
        user: {
          id: 'user-1',
          email: profile.email.toLowerCase(),
          displayName: 'Someone',
          role: upsert.grantAdmin ? Role.Admin : Role.User,
        } as User,
        passwordRemoved: options.passwordRemoved ?? false,
        created: options.created ?? false,
      }),
    ),
    createWithPassword: vi.fn(
      (
        input: { email: string; displayName: string; passwordHash: string },
        upsert: { grantAdmin: boolean },
      ) =>
        Promise.resolve({
          id: 'user-2',
          email: input.email,
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          role: upsert.grantAdmin ? Role.Admin : Role.User,
        } as User),
    ),
    verifyEmail: vi.fn().mockResolvedValue(true),
    findByEmail: vi.fn().mockResolvedValue(options.stored ?? null),
    grantAdmin: vi.fn((user: User) => Promise.resolve({ ...user, role: Role.Admin } as User)),
  };
  const refreshTokens = {
    issue: vi.fn().mockResolvedValue({ token: 't', expiresAt: new Date() }),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  };
  const passwords = {
    hash: vi.fn((password: string) => Promise.resolve(`hashed:${password}`)),
    verify: vi.fn((password: string, stored: string) =>
      Promise.resolve(stored === `hashed:${password}`),
    ),
    verifyDummy: vi.fn().mockResolvedValue(false),
  };
  const config = { get: vi.fn((key: keyof EnvironmentVariables) => env[key]) };
  const jwt = new JwtService({ secret: 'x'.repeat(32) });
  const mail = { send: vi.fn().mockResolvedValue(undefined) };
  const notifications = { notify: vi.fn().mockResolvedValue(true) };
  const service = new AuthService(
    users as unknown as UsersService,
    refreshTokens as unknown as RefreshTokenService,
    jwt,
    config as unknown as ConfigService<EnvironmentVariables, true>,
    passwords as unknown as PasswordHasher,
    mail as unknown as MailService,
    notifications as unknown as NotificationsService,
  );
  return { service, users, refreshTokens, passwords, jwt, mail, notifications };
}

const profile = (email: string) => ({
  googleId: 'g-1',
  email,
  displayName: 'Someone',
  avatarUrl: null,
});

const stored = (email: string, passwordHash: string | null, role = Role.User) =>
  ({ id: 'user-3', email, passwordHash, googleId: passwordHash ? null : 'g-3', role }) as User;

describe('AuthService', () => {
  it('grants admin to emails listed in ADMIN_EMAILS, case-insensitively', async () => {
    const { service, users } = setup();

    const { user } = await service.login(profile('Boss@Example.com'), null);

    expect(user.role).toBe(Role.Admin);
    expect(users.upsertFromProvider).toHaveBeenCalledWith(expect.anything(), { grantAdmin: true });
  });

  it('keeps other users as regular users and starts a session', async () => {
    const { service, refreshTokens } = setup();

    const { user, refresh } = await service.login(profile('fan@example.com'), 'Chrome');

    expect(user.role).toBe(Role.User);
    expect(refresh.token).toBe('t');
    expect(refreshTokens.issue).toHaveBeenCalledWith('user-1', 'Chrome');
    expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('ends the old sessions when Google takes over a password account', async () => {
    const { service, refreshTokens } = setup({ passwordRemoved: true });

    await service.login(profile('fan@example.com'), null);

    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    const [revokedAt] = refreshTokens.revokeAllForUser.mock.invocationCallOrder;
    const [issuedAt] = refreshTokens.issue.mock.invocationCallOrder;
    expect(revokedAt).toBeLessThan(issuedAt ?? 0);
  });

  describe('register', () => {
    it('stores only the hash and starts a session', async () => {
      const { service, users, refreshTokens } = setup();

      const { user } = await service.register(
        { email: 'new@example.com', password: 'long enough', displayName: 'New' },
        'Firefox',
      );

      expect(users.createWithPassword).toHaveBeenCalledWith(
        {
          email: 'new@example.com',
          displayName: 'New',
          passwordHash: 'hashed:long enough',
          emailVerification: {
            tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
            expiresAt: expect.any(Date) as unknown,
          },
        },
        { grantAdmin: false },
      );
      expect(user.role).toBe(Role.User);
      expect(refreshTokens.issue).toHaveBeenCalledWith('user-2', 'Firefox');
    });

    it('grants admin to emails listed in ADMIN_EMAILS', async () => {
      const { service } = setup();

      const { user } = await service.register(
        { email: 'boss@example.com', password: 'long enough', displayName: 'Boss' },
        null,
      );

      expect(user.role).toBe(Role.Admin);
    });
  });

  describe('welcome and verification emails', () => {
    it('sends a welcome with a one-click link whose token matches the stored hash', async () => {
      const { service, users, mail } = setup();

      await service.register(
        { email: 'new@example.com', password: 'long enough', displayName: 'New' },
        null,
      );

      expect(mail.send).toHaveBeenCalledOnce();
      const [to, template, content] = mail.send.mock.calls[0] as [
        string,
        string,
        { subject: string; text: string },
      ];
      expect([to, template, content.subject]).toEqual([
        'new@example.com',
        'welcome',
        'Welcome to Waven',
      ]);
      const link = /http:\/\/localhost:3000\/verify-email\?token=([\w-]+)/.exec(content.text);
      const [input] = users.createWithPassword.mock.calls[0] as unknown as [
        { emailVerification: { tokenHash: string; expiresAt: Date } },
      ];
      expect(hashVerificationToken(link?.[1] ?? '')).toBe(input.emailVerification.tokenHash);
      const ttl = input.emailVerification.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });

    it('welcomes a new Google account without a verification link', async () => {
      const { service, mail } = setup({ created: true });

      await service.login(profile('fan@example.com'), null);

      expect(mail.send).toHaveBeenCalledOnce();
      const [, , content] = mail.send.mock.calls[0] as [string, string, { text: string }];
      expect(content.text).not.toContain('verify-email');
    });

    it('does not welcome a returning Google user', async () => {
      const { service, mail } = setup({ created: false });

      await service.login(profile('fan@example.com'), null);

      expect(mail.send).not.toHaveBeenCalled();
    });

    it('stores a welcome notification for every new account, and only for new ones', async () => {
      const google = setup({ created: true });
      await google.service.login(profile('fan@example.com'), null);
      expect(google.notifications.notify).toHaveBeenCalledWith({
        userId: 'user-1',
        type: NotificationType.Welcome,
        dedupKey: 'welcome',
      });

      const returning = setup({ created: false });
      await returning.service.login(profile('fan@example.com'), null);
      expect(returning.notifications.notify).not.toHaveBeenCalled();

      const password = setup();
      await password.service.register(
        { email: 'new@example.com', password: 'a-long-password', displayName: 'New' },
        null,
      );
      expect(password.notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-2', type: NotificationType.Welcome }),
      );
    });

    it('still signs up when the welcome notification cannot be stored', async () => {
      const { service, notifications } = setup();
      notifications.notify.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.register(
          { email: 'new@example.com', password: 'a-long-password', displayName: 'New' },
          null,
        ),
      ).resolves.toMatchObject({ user: { id: 'user-2' } });
    });

    it('verifies with the hash of the token and rejects an invalid one', async () => {
      const { service, users } = setup();

      await service.verifyEmail('the-token');
      expect(users.verifyEmail).toHaveBeenCalledWith(hashVerificationToken('the-token'));

      users.verifyEmail.mockResolvedValueOnce(false);
      await expect(service.verifyEmail('used')).rejects.toMatchObject({
        status: 400,
        response: { code: 'EMAIL_VERIFICATION_INVALID' },
      });
    });
  });

  describe('loginWithPassword', () => {
    it('signs in with the right password', async () => {
      const { service, refreshTokens } = setup({
        stored: stored('fan@example.com', 'hashed:long enough'),
      });

      const { user } = await service.loginWithPassword(
        { email: 'fan@example.com', password: 'long enough' },
        null,
      );

      expect(user.id).toBe('user-3');
      expect(refreshTokens.issue).toHaveBeenCalledWith('user-3', null);
    });

    it('grants admin to emails listed in ADMIN_EMAILS', async () => {
      const { service, users } = setup({
        stored: stored('boss@example.com', 'hashed:long enough'),
      });

      const { user } = await service.loginWithPassword(
        { email: 'boss@example.com', password: 'long enough' },
        null,
      );

      expect(user.role).toBe(Role.Admin);
      expect(users.grantAdmin).toHaveBeenCalledOnce();
    });

    it.each([
      ['a wrong password', stored('fan@example.com', 'hashed:long enough'), 'wrong one'],
      ['an unknown email', null, 'long enough'],
      ['a Google-only account', stored('fan@example.com', null), 'long enough'],
    ])('answers the same 401 for %s', async (_case, user, password) => {
      const { service, refreshTokens } = setup({ stored: user });

      const attempt = service.loginWithPassword({ email: 'fan@example.com', password }, null);

      await expect(attempt).rejects.toThrow(UnauthorizedException);
      await expect(attempt).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('still runs a hash when there is no password to check', async () => {
      const { service, passwords } = setup({ stored: null });

      await expect(
        service.loginWithPassword({ email: 'ghost@example.com', password: 'long enough' }, null),
      ).rejects.toThrow(UnauthorizedException);

      expect(passwords.verifyDummy).toHaveBeenCalledWith('long enough');
    });
  });

  it('signs an access token with the user id and role', async () => {
    const { service, jwt } = setup();

    const { accessToken, expiresIn } = await service.signAccessToken({
      id: 'user-1',
      role: Role.User,
    });

    expect(expiresIn).toBe(900);
    expect(await jwt.verifyAsync(accessToken)).toMatchObject({ sub: 'user-1', role: Role.User });
  });

  describe('assertTrustedOrigin', () => {
    const request = (headers: Record<string, string>) => ({ headers }) as unknown as Request;

    it('accepts same-origin requests with the custom header', () => {
      const { service } = setup();
      expect(() =>
        service.assertTrustedOrigin(
          request({ origin: 'http://localhost:3000', 'x-requested-with': 'fetch' }),
        ),
      ).not.toThrow();
    });

    it.each([
      [{ origin: 'http://localhost:3000' }],
      [{ origin: 'https://evil.example.com', 'x-requested-with': 'fetch' }],
      [{ 'x-requested-with': 'fetch' }],
    ])('rejects %o', (headers) => {
      const { service } = setup();
      expect(() => service.assertTrustedOrigin(request(headers))).toThrow(ForbiddenException);
    });
  });
});
