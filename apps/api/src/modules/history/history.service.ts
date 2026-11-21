import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service.js';
import { Track } from '../catalog/entities/track.entity.js';
import { type RecordPlayDto } from './history.dto.js';

/** SPEC §6.4: a play counts after 30 s, or the whole track if it is shorter. */
export const MIN_PLAY_MS = 30_000;

/**
 * The browser's playback clock and the stored duration (read from the encoded
 * file) differ by a few frames, so a full play of a short track may report
 * slightly less than `durationMs`.
 */
export const FULL_PLAY_TOLERANCE_MS = 1_000;

export function requiredPlayMs(durationMs: number | null): number {
  if (!durationMs || durationMs <= 0) {
    return MIN_PLAY_MS;
  }
  return Math.min(MIN_PLAY_MS, Math.max(0, durationMs - FULL_PLAY_TOLERANCE_MS));
}

@Injectable()
export class HistoryService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Records a valid play and bumps the track's playCount (SPEC §6.5) in one
   * transaction. Repeating a `playId` is a no-op, so client retries are safe.
   * Returns whether a new row was written.
   */
  async record(userId: string, dto: RecordPlayDto): Promise<boolean> {
    const track = await this.catalog.findReadyTrack(dto.trackId);
    const required = requiredPlayMs(track.durationMs);
    if (dto.msPlayed < required) {
      throw new UnprocessableEntityException({
        code: 'PLAY_TOO_SHORT',
        message: `A play counts after ${required} ms of listening`,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const inserted: unknown[] = await manager.query(
        `INSERT INTO "play_history" ("user_id", "track_id", "play_id", "ms_played", "context")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("user_id", "play_id") DO NOTHING
         RETURNING "id"`,
        [userId, track.id, dto.playId, dto.msPlayed, dto.context],
      );
      if (inserted.length === 0) {
        return false;
      }
      await manager.increment(Track, { id: track.id }, 'playCount', 1);
      return true;
    });
  }
}
