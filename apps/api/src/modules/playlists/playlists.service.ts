import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, Repository } from 'typeorm';
import { CatalogMapper } from '../catalog/catalog.mapper.js';
import { type ImageSetDto } from '../catalog/dto/catalog.dto.js';
import { isTrackAvailable, Track, TrackStatus } from '../catalog/entities/track.entity.js';
import { getEffectivePlan, PLAN_LIMITS } from '../users/plan.js';
import { PlaylistTrack } from './playlist-track.entity.js';
import { Playlist } from './playlist.entity.js';
import {
  type AddTracksDto,
  type CreatePlaylistDto,
  MAX_PLAYLIST_TRACKS,
  type PlaylistDetailDto,
  type PlaylistEntryDto,
  type PlaylistPageDto,
  type PlaylistSummaryDto,
  type UpdatePlaylistDto,
} from './playlists.dto.js';

const MOSAIC_SIZE = 4;

/** SPEC §6.2: a Free user over the limit keeps their playlists but cannot create more. */
export function canCreatePlaylist(owned: number, maxPlaylists: number | null): boolean {
  return maxPlaylists === null || owned < maxPlaylists;
}

/** Clamps a requested position into `[0, max]`; `undefined` means `max`. */
export function clampPosition(requested: number | undefined, max: number): number {
  return requested === undefined ? max : Math.min(Math.max(requested, 0), max);
}

function playlistNotFound(): NotFoundException {
  return new NotFoundException({ code: 'PLAYLIST_NOT_FOUND', message: 'Playlist not found' });
}

/**
 * Playlists can only be seen and changed by their owner; any other playlist is
 * reported as missing (SPEC §6.6). Track changes run in a transaction that
 * locks the playlist row, so concurrent edits (two tabs) apply one at a time
 * and positions stay contiguous.
 */
@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist) private readonly playlists: Repository<Playlist>,
    private readonly dataSource: DataSource,
    private readonly mapper: CatalogMapper,
  ) {}

  async list(ownerId: string, limit: number, offset: number): Promise<PlaylistPageDto> {
    const [playlists, total] = await this.playlists.findAndCount({
      where: { ownerId },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: limit,
      skip: offset,
    });
    const ids = playlists.map((playlist) => playlist.id);
    const [counts, covers] = await Promise.all([
      this.trackCounts(this.dataSource.manager, ids),
      this.mosaics(this.dataSource.manager, ids),
    ]);
    return {
      items: playlists.map((playlist) =>
        this.summary(playlist, counts.get(playlist.id) ?? 0, covers.get(playlist.id) ?? []),
      ),
      total,
      limit,
      offset,
    };
  }

  async create(ownerId: string, dto: CreatePlaylistDto): Promise<PlaylistDetailDto> {
    const { maxPlaylists } = PLAN_LIMITS[getEffectivePlan()];
    const playlist = await this.dataSource.transaction(async (manager) => {
      // Serializes creations per user, so two parallel requests cannot both pass the limit.
      await manager.query('SELECT 1 FROM "users" WHERE "id" = $1 FOR UPDATE', [ownerId]);
      const owned = await manager.count(Playlist, { where: { ownerId } });
      if (!canCreatePlaylist(owned, maxPlaylists)) {
        throw new ForbiddenException({
          code: 'PLAN_LIMIT_REACHED',
          message: `Your plan allows up to ${maxPlaylists} playlists`,
        });
      }
      return manager.save(
        manager.create(Playlist, {
          ownerId,
          name: dto.name ?? `My Playlist #${owned + 1}`,
          description: dto.description ?? null,
        }),
      );
    });
    return this.detail(this.dataSource.manager, playlist);
  }

  async get(ownerId: string, id: string): Promise<PlaylistDetailDto> {
    return this.detail(
      this.dataSource.manager,
      await this.findOwned(this.dataSource.manager, ownerId, id),
    );
  }

  async update(ownerId: string, id: string, dto: UpdatePlaylistDto): Promise<PlaylistDetailDto> {
    const playlist = await this.findOwned(this.dataSource.manager, ownerId, id);
    if (dto.name !== undefined) {
      playlist.name = dto.name;
    }
    if (dto.description !== undefined) {
      playlist.description = dto.description;
    }
    return this.detail(this.dataSource.manager, await this.playlists.save(playlist));
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const result = await this.playlists.delete({ id, ownerId });
    if (!result.affected) {
      throw playlistNotFound();
    }
  }

  async addTracks(ownerId: string, id: string, dto: AddTracksDto): Promise<PlaylistDetailDto> {
    return this.dataSource.transaction(async (manager) => {
      const playlist = await this.lockOwned(manager, ownerId, id);
      const distinct = [...new Set(dto.trackIds)];
      const playable = await manager.count(Track, {
        where: { id: In(distinct), status: TrackStatus.Ready },
      });
      if (playable !== distinct.length) {
        throw new NotFoundException({ code: 'TRACK_NOT_FOUND', message: 'Track not found' });
      }

      const count = await manager.count(PlaylistTrack, { where: { playlistId: id } });
      if (count + dto.trackIds.length > MAX_PLAYLIST_TRACKS) {
        throw new ConflictException({
          code: 'PLAYLIST_FULL',
          message: `A playlist holds up to ${MAX_PLAYLIST_TRACKS} tracks`,
        });
      }
      const position = clampPosition(dto.position, count);
      await manager.query(
        'UPDATE "playlist_tracks" SET "position" = "position" + $3 WHERE "playlist_id" = $1 AND "position" >= $2',
        [id, position, dto.trackIds.length],
      );
      await manager.insert(
        PlaylistTrack,
        dto.trackIds.map((trackId, index) => ({
          playlistId: id,
          trackId,
          position: position + index,
        })),
      );
      return this.detail(manager, playlist);
    });
  }

  async removeEntry(ownerId: string, id: string, entryId: string): Promise<PlaylistDetailDto> {
    return this.dataSource.transaction(async (manager) => {
      const playlist = await this.lockOwned(manager, ownerId, id);
      const entry = await this.findEntry(manager, id, entryId);
      await manager.delete(PlaylistTrack, { id: entry.id });
      await manager.query(
        'UPDATE "playlist_tracks" SET "position" = "position" - 1 WHERE "playlist_id" = $1 AND "position" > $2',
        [id, entry.position],
      );
      return this.detail(manager, playlist);
    });
  }

  async moveEntry(
    ownerId: string,
    id: string,
    entryId: string,
    requested: number,
  ): Promise<PlaylistDetailDto> {
    return this.dataSource.transaction(async (manager) => {
      const playlist = await this.lockOwned(manager, ownerId, id);
      const entry = await this.findEntry(manager, id, entryId);
      const count = await manager.count(PlaylistTrack, { where: { playlistId: id } });
      const from = entry.position;
      const to = clampPosition(requested, count - 1);
      if (from < to) {
        await manager.query(
          'UPDATE "playlist_tracks" SET "position" = "position" - 1 WHERE "playlist_id" = $1 AND "position" > $2 AND "position" <= $3',
          [id, from, to],
        );
      } else if (from > to) {
        await manager.query(
          'UPDATE "playlist_tracks" SET "position" = "position" + 1 WHERE "playlist_id" = $1 AND "position" >= $2 AND "position" < $3',
          [id, to, from],
        );
      }
      if (from !== to) {
        await manager.update(PlaylistTrack, { id: entry.id }, { position: to });
      }
      return this.detail(manager, playlist);
    });
  }

  private async findOwned(manager: EntityManager, ownerId: string, id: string): Promise<Playlist> {
    const playlist = await manager.findOne(Playlist, { where: { id, ownerId } });
    if (!playlist) {
      throw playlistNotFound();
    }
    return playlist;
  }

  /** Checks ownership, locks the row until the transaction ends and bumps `updatedAt`. */
  private async lockOwned(manager: EntityManager, ownerId: string, id: string): Promise<Playlist> {
    const playlist = await manager.findOne(Playlist, {
      where: { id, ownerId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!playlist) {
      throw playlistNotFound();
    }
    playlist.updatedAt = new Date();
    await manager.update(Playlist, { id }, { updatedAt: playlist.updatedAt });
    return playlist;
  }

  private async findEntry(manager: EntityManager, playlistId: string, entryId: string) {
    const entry = await manager.findOne(PlaylistTrack, { where: { id: entryId, playlistId } });
    if (!entry) {
      throw new NotFoundException({ code: 'ENTRY_NOT_FOUND', message: 'Playlist entry not found' });
    }
    return entry;
  }

  private async detail(manager: EntityManager, playlist: Playlist): Promise<PlaylistDetailDto> {
    const entries = await manager
      .createQueryBuilder(PlaylistTrack, 'entry')
      // Deleted tracks stay in the playlist, marked as unavailable (SPEC §6.7). Must precede the joins.
      .withDeleted()
      .innerJoinAndSelect('entry.track', 'track')
      .innerJoinAndSelect('track.album', 'album')
      .innerJoinAndSelect('track.artist', 'artist')
      .where('entry.playlistId = :id', { id: playlist.id })
      .orderBy('entry.position', 'ASC')
      .getMany();

    const items = entries.map((entry): PlaylistEntryDto => ({
      id: entry.id,
      position: entry.position,
      addedAt: entry.addedAt.toISOString(),
      available: isTrackAvailable(required(entry.track)),
      track: this.mapper.track(required(entry.track)),
    }));
    return {
      ...this.summary(playlist, entries.length, this.mosaicOf(entries)),
      durationMs: items.reduce(
        (sum, entry) => (entry.available ? sum + entry.track.durationMs : sum),
        0,
      ),
      entries: items,
    };
  }

  private summary(
    playlist: Playlist,
    trackCount: number,
    covers: ImageSetDto[],
  ): PlaylistSummaryDto {
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      trackCount,
      covers,
      createdAt: playlist.createdAt.toISOString(),
      updatedAt: playlist.updatedAt.toISOString(),
    };
  }

  private mosaicOf(entries: PlaylistTrack[]): ImageSetDto[] {
    const keys: string[] = [];
    for (const entry of entries) {
      const key = entry.track?.album?.coverKey;
      if (key && !keys.includes(key)) {
        keys.push(key);
        if (keys.length === MOSAIC_SIZE) {
          break;
        }
      }
    }
    return keys.flatMap((key) => this.mapper.imageSet(key) ?? []);
  }

  private async trackCounts(manager: EntityManager, ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows: { playlist_id: string; count: string }[] = await manager.query(
      'SELECT "playlist_id", count(*) AS "count" FROM "playlist_tracks" WHERE "playlist_id" = ANY($1) GROUP BY "playlist_id"',
      [ids],
    );
    return new Map(rows.map((row) => [row.playlist_id, Number(row.count)]));
  }

  /** First distinct album covers of each playlist, in position order. */
  private async mosaics(
    manager: EntityManager,
    ids: string[],
  ): Promise<Map<string, ImageSetDto[]>> {
    if (ids.length === 0) {
      return new Map();
    }
    const rows: { playlist_id: string; cover_key: string }[] = await manager.query(
      `SELECT "playlist_id", "cover_key" FROM (
         SELECT "pt"."playlist_id", "a"."cover_key", min("pt"."position") AS "first",
                row_number() OVER (PARTITION BY "pt"."playlist_id" ORDER BY min("pt"."position")) AS "rank"
         FROM "playlist_tracks" "pt"
         JOIN "tracks" "t" ON "t"."id" = "pt"."track_id"
         JOIN "albums" "a" ON "a"."id" = "t"."album_id"
         WHERE "pt"."playlist_id" = ANY($1) AND "a"."cover_key" IS NOT NULL
         GROUP BY "pt"."playlist_id", "a"."cover_key"
       ) "c"
       WHERE "rank" <= $2
       ORDER BY "playlist_id", "first"`,
      [ids, MOSAIC_SIZE],
    );
    const covers = new Map<string, ImageSetDto[]>();
    for (const row of rows) {
      const image = this.mapper.imageSet(row.cover_key);
      if (image) {
        covers.set(row.playlist_id, [...(covers.get(row.playlist_id) ?? []), image]);
      }
    }
    return covers;
  }
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('entry.track must be loaded');
  }
  return value;
}
