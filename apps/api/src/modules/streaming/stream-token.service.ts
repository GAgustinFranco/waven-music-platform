import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { StreamQuality } from '../users/plan.js';

export interface StreamTokenPayload {
  userId: string;
  trackId: string;
  quality: StreamQuality;
  /** Expiry as a Unix timestamp in seconds. */
  exp: number;
}

const QUALITIES = new Set<string>(Object.values(StreamQuality));

/**
 * Signed, short-lived token for `GET /stream/:trackId`. `<audio>` cannot send an
 * Authorization header, so the URL carries the user, track and quality, signed
 * with HMAC-SHA256: `base64url(payload).base64url(signature)`.
 */
@Injectable()
export class StreamTokenService {
  private readonly secret: string;
  readonly ttlSeconds: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.secret = config.get('STREAM_TOKEN_SECRET', { infer: true });
    this.ttlSeconds = config.get('STREAM_TOKEN_TTL', { infer: true });
  }

  sign(
    claims: Omit<StreamTokenPayload, 'exp'>,
    now = new Date(),
  ): { token: string; expiresAt: Date } {
    const exp = Math.floor(now.getTime() / 1000) + this.ttlSeconds;
    const payload: StreamTokenPayload = { ...claims, exp };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return { token: `${encoded}.${this.signature(encoded)}`, expiresAt: new Date(exp * 1000) };
  }

  /** Throws 401 unless the token is authentic, unexpired and issued for `trackId`. */
  verify(token: string, trackId: string, now = new Date()): StreamTokenPayload {
    const [encoded, signature, ...rest] = token.split('.');
    if (!encoded || !signature || rest.length > 0 || !this.matches(encoded, signature)) {
      throw invalid('STREAM_TOKEN_INVALID', 'Invalid stream token');
    }
    const payload = parsePayload(encoded);
    if (!payload || payload.trackId !== trackId) {
      throw invalid('STREAM_TOKEN_INVALID', 'Invalid stream token');
    }
    if (payload.exp * 1000 <= now.getTime()) {
      throw invalid('STREAM_TOKEN_EXPIRED', 'The stream token has expired');
    }
    return payload;
  }

  private signature(encoded: string): string {
    return createHmac('sha256', this.secret).update(encoded).digest('base64url');
  }

  private matches(encoded: string, signature: string): boolean {
    const expected = Buffer.from(this.signature(encoded));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}

function parsePayload(encoded: string): StreamTokenPayload | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (
      typeof value === 'object' &&
      value !== null &&
      'userId' in value &&
      typeof value.userId === 'string' &&
      'trackId' in value &&
      typeof value.trackId === 'string' &&
      'quality' in value &&
      typeof value.quality === 'string' &&
      QUALITIES.has(value.quality) &&
      'exp' in value &&
      typeof value.exp === 'number'
    ) {
      return {
        userId: value.userId,
        trackId: value.trackId,
        quality: value.quality as StreamQuality,
        exp: value.exp,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function invalid(code: string, message: string): UnauthorizedException {
  return new UnauthorizedException({ code, message });
}
