import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CatalogMapper } from '../catalog/catalog.mapper.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { isTrackAvailable, Track } from '../catalog/entities/track.entity.js';
import { type HistoryPageDto, type RecordPlayDto } from './history.dto.js';
import { PlayHistory } from './play-history.entity.js';

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
    private readonly mapper: CatalogMapper,
    private readonly dataSource: DataSource,
    @InjectRepository(PlayHistory) private readonly history: Repository<PlayHistory>,
  ) {}

  /**
   * Newest play first, one entry per play. Keyset pagination on
   * (playedAt, id): plays recorded while paging never shift a page, so no
   * entry shows up twice. An unknown cursor yields an empty page.
   */
  async list(userId: string, limit: number, cursor?: string): Promise<HistoryPageDto> {
    const query = this.history
      .createQueryBuilder('entry')
      // Deleted tracks stay in the history, as unavailable. Must precede the joins.
      .withDeleted()
      .innerJoinAndSelect('entry.track', 'track')
      .innerJoinAndSelect('track.album', 'album')
      .innerJoinAndSelect('track.artist', 'artist')
      .where('entry.userId = :userId', { userId })
      .orderBy('entry.playedAt', 'DESC')
      .addOrderBy('entry.id', 'DESC')
      // Only many-to-one joins, so a plain LIMIT is exact; one extra row tells if there is more.
      .limit(limit + 1);
    if (cursor) {
      query.andWhere(
        `("entry"."played_at", "entry"."id") < (
          SELECT "c"."played_at", "c"."id" FROM "play_history" "c"
           WHERE "c"."id" = :cursor AND "c"."user_id" = :userId)`,
        { cursor },
      );
    }
    const rows = await query.getMany();
    const page = rows.slice(0, limit);
    return {
      items: page.map((entry) => {
        if (!entry.track) {
          throw new Error('entry.track must be loaded');
        }
        return {
          id: entry.id,
          playedAt: entry.playedAt.toISOString(),
          context: entry.context,
          available: isTrackAvailable(entry.track),
          track: this.mapper.track(entry.track),
        };
      }),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

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
