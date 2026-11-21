import { ForbiddenException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { Role, type User } from '../users/user.entity.js';
import { type UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { type RefreshTokenService } from './refresh-token.service.js';

const env: Partial<EnvironmentVariables> = {
  ADMIN_EMAILS: ['boss@example.com'],
  JWT_ACCESS_TTL: 900,
  WEB_URL: 'http://localhost:3000',
};

function setup() {
  const users = {
    upsertFromProvider: vi.fn((_profile: unknown, options: { grantAdmin: boolean }) =>
      Promise.resolve({ id: 'user-1', role: options.grantAdmin ? Role.Admin : Role.User } as User),
    ),
  };
  const refreshTokens = { issue: vi.fn().mockResolvedValue({ token: 't', expiresAt: new Date() }) };
  const config = { get: vi.fn((key: keyof EnvironmentVariables) => env[key]) };
  const jwt = new JwtService({ secret: 'x'.repeat(32) });
  const service = new AuthService(
    users as unknown as UsersService,
    refreshTokens as unknown as RefreshTokenService,
    jwt,
    config as unknown as ConfigService<EnvironmentVariables, true>,
  );
  return { service, users, refreshTokens, jwt };
}

const profile = (email: string) => ({
  googleId: 'g-1',
  email,
  displayName: 'Someone',
  avatarUrl: null,
});

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
