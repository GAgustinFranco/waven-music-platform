import { UnauthorizedException } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { type Repository } from 'typeorm';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { Role, type User } from '../users/user.entity.js';
import { type RefreshToken } from './refresh-token.entity.js';
import { hashToken, RefreshTokenService } from './refresh-token.service.js';

const user = { id: 'user-1', role: Role.User } as User;

function storedToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'token-1',
    userId: user.id,
    user,
    tokenHash: hashToken('current'),
    familyId: 'family-1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    userAgent: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function setup() {
  const repo = {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    insert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  const config = { get: vi.fn().mockReturnValue(30) };
  const service = new RefreshTokenService(
    repo as unknown as Repository<RefreshToken>,
    config as unknown as ConfigService<EnvironmentVariables, true>,
  );
  return { repo, service };
}

const errorCode = async (promise: Promise<unknown>): Promise<unknown> => {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(UnauthorizedException);
  return ((error as UnauthorizedException).getResponse() as { code: string }).code;
};

describe('RefreshTokenService', () => {
  it('issues an opaque token and stores only its hash in a new family', async () => {
    const { repo, service } = setup();

    const issued = await service.issue(user.id, 'Firefox');

    expect(issued.token).toMatch(/^[\w-]{43}$/);
    const [row] = repo.insert.mock.calls[0] as [Partial<RefreshToken>];
    expect(row.tokenHash).toBe(hashToken(issued.token));
    expect(row).not.toHaveProperty('token');
    expect(row.familyId).toEqual(expect.any(String));
    expect(row.expiresAt?.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it('rotates a valid token within the same family', async () => {
    const { repo, service } = setup();
    repo.findOne.mockResolvedValue(storedToken());

    const rotated = await service.rotate('current', null);

    expect(rotated.user).toBe(user);
    expect(rotated.token).not.toBe('current');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'token-1' }), {
      revokedAt: expect.any(Date),
    });
    const [row] = repo.insert.mock.calls[0] as [Partial<RefreshToken>];
    expect(row.familyId).toBe('family-1');
    expect(row.tokenHash).toBe(hashToken(rotated.token));
  });

  it('revokes the whole family when a revoked token is reused', async () => {
    const { repo, service } = setup();
    repo.findOne.mockResolvedValue(storedToken({ revokedAt: new Date() }));

    expect(await errorCode(service.rotate('current', null))).toBe('REFRESH_TOKEN_REUSED');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ familyId: 'family-1' }), {
      revokedAt: expect.any(Date),
    });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('revokes the family when it loses a race for the same token', async () => {
    const { repo, service } = setup();
    repo.findOne.mockResolvedValue(storedToken());
    repo.update.mockResolvedValueOnce({ affected: 0 });

    expect(await errorCode(service.rotate('current', null))).toBe('INVALID_REFRESH_TOKEN');
    expect(repo.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ familyId: 'family-1' }),
      { revokedAt: expect.any(Date) },
    );
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown', undefined],
    ['expired', storedToken({ expiresAt: new Date(Date.now() - 1) })],
  ])('rejects an %s token', async (_label, stored) => {
    const { repo, service } = setup();
    repo.findOne.mockResolvedValue(stored ?? null);

    expect(await errorCode(service.rotate('current', null))).toBe('INVALID_REFRESH_TOKEN');
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('revokes the family on logout', async () => {
    const { repo, service } = setup();
    repo.findOneBy.mockResolvedValue(storedToken());

    await service.revoke('current');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ familyId: 'family-1' }), {
      revokedAt: expect.any(Date),
    });
  });
});
