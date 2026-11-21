import { type ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { StreamQuality } from '../users/plan.js';
import { StreamTokenService } from './stream-token.service.js';

const config = (secret: string) =>
  ({
    get: (key: string) => ({ STREAM_TOKEN_SECRET: secret, STREAM_TOKEN_TTL: 3600 })[key],
  }) as unknown as ConfigService<EnvironmentVariables, true>;

const USER = '11111111-1111-4111-8111-111111111111';
const TRACK = '22222222-2222-4222-8222-222222222222';
const OTHER_TRACK = '33333333-3333-4333-8333-333333333333';

describe('StreamTokenService', () => {
  const service = new StreamTokenService(config('s'.repeat(32)));
  const now = new Date('2026-11-20T12:00:00Z');

  it('round-trips the claims and expires after the TTL', () => {
    const { token, expiresAt } = service.sign(
      { userId: USER, trackId: TRACK, quality: StreamQuality.Standard },
      now,
    );

    expect(expiresAt.toISOString()).toBe('2026-11-20T13:00:00.000Z');
    expect(service.verify(token, TRACK, now)).toMatchObject({
      userId: USER,
      trackId: TRACK,
      quality: StreamQuality.Standard,
    });
  });

  it('rejects an expired token', () => {
    const { token } = service.sign(
      { userId: USER, trackId: TRACK, quality: StreamQuality.High },
      now,
    );
    const later = new Date(now.getTime() + 3600_000);

    expect(() => service.verify(token, TRACK, later)).toThrow('expired');
  });

  it('rejects a token issued for another track', () => {
    const { token } = service.sign(
      { userId: USER, trackId: TRACK, quality: StreamQuality.High },
      now,
    );

    expect(() => service.verify(token, OTHER_TRACK, now)).toThrow('Invalid stream token');
  });

  it('rejects tampered claims (e.g. upgrading the quality)', () => {
    const { token } = service.sign(
      { userId: USER, trackId: TRACK, quality: StreamQuality.Standard },
      now,
    );
    const [encoded, signature] = token.split('.') as [string, string];
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as object;
    const forged = Buffer.from(JSON.stringify({ ...claims, quality: 'high' })).toString(
      'base64url',
    );

    expect(() => service.verify(`${forged}.${signature}`, TRACK, now)).toThrow(
      'Invalid stream token',
    );
  });

  it('rejects tokens signed with another secret and malformed tokens', () => {
    const other = new StreamTokenService(config('x'.repeat(32)));
    const { token } = other.sign(
      { userId: USER, trackId: TRACK, quality: StreamQuality.High },
      now,
    );

    for (const candidate of [token, 'garbage', 'a.b.c', '']) {
      expect(() => service.verify(candidate, TRACK, now)).toThrow('Invalid stream token');
    }
  });
});
