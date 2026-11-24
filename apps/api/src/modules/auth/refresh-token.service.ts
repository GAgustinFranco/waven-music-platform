import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { type User } from '../users/user.entity.js';
import { RefreshToken } from './refresh-token.entity.js';

const DAY_MS = 86_400_000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  user: User;
}

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const invalidToken = () =>
  new UnauthorizedException({
    code: 'INVALID_REFRESH_TOKEN',
    message: 'The session is invalid or expired',
  });

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Starts a new token family (a new login). */
  issue(userId: string, userAgent: string | null): Promise<IssuedRefreshToken> {
    return this.create(userId, randomUUID(), userAgent);
  }

  /**
   * Revokes the presented token and issues its successor in the same family.
   * A token that was already revoked means it leaked: the whole family goes.
   */
  async rotate(token: string, userAgent: string | null): Promise<RotatedRefreshToken> {
    const current = await this.tokens.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });

    if (!current) {
      throw invalidToken();
    }
    if (current.revokedAt) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'This session was revoked. Sign in again',
      });
    }
    if (current.expiresAt.getTime() <= Date.now()) {
      throw invalidToken();
    }

    // Conditional update: if two requests race with the same token, only one wins.
    const result = await this.tokens.update(
      { id: current.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (result.affected !== 1) {
      await this.revokeFamily(current.familyId);
      throw invalidToken();
    }

    const next = await this.create(current.userId, current.familyId, userAgent);
    return { ...next, user: current.user };
  }

  /** Revokes the family of the presented token, if it exists. */
  async revoke(token: string): Promise<void> {
    const current = await this.tokens.findOneBy({ tokenHash: hashToken(token) });
    if (current) {
      await this.revokeFamily(current.familyId);
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /** Signs the user out everywhere. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async create(
    userId: string,
    familyId: string,
    userAgent: string | null,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * DAY_MS);

    await this.tokens.insert({
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: userAgent?.slice(0, 255) ?? null,
    });

    return { token, expiresAt };
  }
}
