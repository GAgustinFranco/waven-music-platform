import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { type AuthUser } from '../auth/auth.types.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { getEffectivePlan, PLAN_LIMITS, StreamQuality } from '../users/plan.js';
import { type StreamUrlDto } from './stream.dto.js';
import { StreamTokenService } from './stream-token.service.js';

export interface ResolvedStream {
  key: string;
  /** Seconds the token remains valid; presigned URLs never outlive it. */
  remainingSeconds: number;
}

@Injectable()
export class StreamingService {
  private readonly baseUrl: string;

  constructor(
    private readonly catalog: CatalogService,
    private readonly tokens: StreamTokenService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.baseUrl = config.get('STREAM_BASE_URL', { infer: true }).replace(/\/+$/, '');
  }

  /** SPEC §6.3: the quality is fixed from the plan when the token is issued. */
  async issue(user: AuthUser, trackId: string): Promise<StreamUrlDto> {
    const track = await this.catalog.findReadyTrack(trackId);
    const quality = PLAN_LIMITS[getEffectivePlan()].streamQuality;
    const { token, expiresAt } = this.tokens.sign({ userId: user.id, trackId: track.id, quality });
    return {
      url: `${this.baseUrl}/stream/${track.id}?token=${encodeURIComponent(token)}`,
      quality,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async resolve(
    trackId: string,
    token: string | undefined,
    now = new Date(),
  ): Promise<ResolvedStream> {
    if (!token) {
      throw new UnauthorizedException({
        code: 'STREAM_TOKEN_INVALID',
        message: 'Missing stream token',
      });
    }
    const payload = this.tokens.verify(token, trackId, now);
    const track = await this.catalog.findReadyTrack(trackId);
    const key = payload.quality === StreamQuality.High ? track.audioKeyHigh : track.audioKeyStd;
    if (!key) {
      throw new NotFoundException({ code: 'TRACK_NOT_FOUND', message: 'Track not found' });
    }
    return { key, remainingSeconds: Math.max(1, payload.exp - Math.floor(now.getTime() / 1000)) };
  }
}
