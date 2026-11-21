import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type QueryRunner, Repository, type SelectQueryBuilder } from 'typeorm';
import { CatalogMapper } from './catalog.mapper.js';
import {
  type AlbumDetailDto,
  type AlbumPageDto,
  type AlbumSummaryDto,
  type ArtistDetailDto,
  type ArtistPageDto,
  type HomeDto,
  type TrackDto,
} from './dto/catalog.dto.js';
import { Album } from './entities/album.entity.js';
import { Artist } from './entities/artist.entity.js';
import { Track, TrackStatus } from './entities/track.entity.js';

const POPULAR_TRACKS = 10;
const NEW_RELEASES = 12;
const RECENTLY_PLAYED = 10;

/** A track is public when it is ready and not soft-deleted (SPEC §6.7). */
const hasReadyTrack = (column: 'artist_id' | 'album_id', ref: string) =>
  `EXISTS (SELECT 1 FROM "tracks" "t" WHERE "t"."${column}" = ${ref} AND "t"."status" = :ready AND "t"."deleted_at" IS NULL)`;

/**
 * Read side of the catalog. Only `ready`, non-deleted tracks are exposed, and
 * artists or albums without any of them are hidden.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Artist) private readonly artists: Repository<Artist>,
    @InjectRepository(Album) private readonly albums: Repository<Album>,
    @InjectRepository(Track) private readonly tracks: Repository<Track>,
    private readonly mapper: CatalogMapper,
  ) {}

  async listArtists(limit: number, offset: number): Promise<ArtistPageDto> {
    const [items, total] = await this.visibleArtists()
      .orderBy('artist.name', 'ASC')
      .addOrderBy('artist.id', 'ASC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return {
      items: items.map((artist) => this.mapper.artistSummary(artist)),
      total,
      limit,
      offset,
    };
  }

  async getArtist(id: string): Promise<ArtistDetailDto> {
    const artist = await this.visibleArtists().andWhere('artist.id = :id', { id }).getOne();
    if (!artist) {
      throw new NotFoundException({ code: 'ARTIST_NOT_FOUND', message: 'Artist not found' });
    }
    const [albums, popularTracks] = await Promise.all([
      this.newestFirst(this.visibleAlbums().andWhere('album.artistId = :id', { id })).getMany(),
      this.readyTracks()
        .andWhere('track.artistId = :id', { id })
        .orderBy('track.playCount', 'DESC')
        .addOrderBy('track.title', 'ASC')
        .take(POPULAR_TRACKS)
        .getMany(),
    ]);
    return {
      ...this.mapper.artistSummary(artist),
      bio: artist.bio,
      albums: albums.map((album) => this.mapper.albumSummary(album)),
      popularTracks: popularTracks.map((track) => this.mapper.track(track)),
    };
  }

  async listAlbums(limit: number, offset: number): Promise<AlbumPageDto> {
    const [items, total] = await this.newestFirst(this.visibleAlbums())
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items: items.map((album) => this.mapper.albumSummary(album)), total, limit, offset };
  }

  async getAlbum(id: string): Promise<AlbumDetailDto> {
    const album = await this.visibleAlbums().andWhere('album.id = :id', { id }).getOne();
    if (!album) {
      throw new NotFoundException({ code: 'ALBUM_NOT_FOUND', message: 'Album not found' });
    }
    const tracks = await this.readyTracks()
      .andWhere('track.albumId = :id', { id })
      .orderBy('track.trackNumber', 'ASC')
      .addOrderBy('track.title', 'ASC')
      .getMany();
    return {
      ...this.mapper.albumSummary(album),
      tracks: tracks.map((track) => this.mapper.track(track)),
      durationMs: tracks.reduce((sum, track) => sum + (track.durationMs ?? 0), 0),
    };
  }

  async getTrack(id: string): Promise<TrackDto> {
    return this.mapper.track(await this.findReadyTrack(id));
  }

  /** A public track, with its album and artist; 404 otherwise. */
  async findReadyTrack(id: string): Promise<Track> {
    const track = await this.readyTracks().andWhere('track.id = :id', { id }).getOne();
    if (!track) {
      throw new NotFoundException({ code: 'TRACK_NOT_FOUND', message: 'Track not found' });
    }
    return track;
  }

  async home(userId: string): Promise<HomeDto> {
    const [albums, popular, recent] = await Promise.all([
      this.newestFirst(this.visibleAlbums()).take(NEW_RELEASES).getMany(),
      this.readyTracks()
        .orderBy('track.playCount', 'DESC')
        .addOrderBy('track.createdAt', 'DESC')
        .take(POPULAR_TRACKS)
        .getMany(),
      this.recentlyPlayed(userId),
    ]);
    return {
      newReleases: albums.map((album): AlbumSummaryDto => this.mapper.albumSummary(album)),
      popularTracks: popular.map((track) => this.mapper.track(track)),
      recentlyPlayed: recent.map((track) => this.mapper.track(track)),
    };
  }

  /**
   * The user's last distinct public tracks, by their latest play (SPEC §6.4:
   * no repeats). Reads `play_history` by table name so the catalog does not
   * depend on the history module.
   */
  async recentlyPlayed(userId: string, limit = RECENTLY_PLAYED): Promise<Track[]> {
    const rows: { track_id: string }[] = await this.tracks.query(
      `SELECT "ph"."track_id"
         FROM "play_history" "ph"
         JOIN "tracks" "t" ON "t"."id" = "ph"."track_id"
        WHERE "ph"."user_id" = $1 AND "t"."status" = $2 AND "t"."deleted_at" IS NULL
        GROUP BY "ph"."track_id"
        ORDER BY MAX("ph"."played_at") DESC
        LIMIT $3`,
      [userId, TrackStatus.Ready, limit],
    );
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.track_id);
    const tracks = await this.readyTracks().andWhere('track.id IN (:...ids)', { ids }).getMany();
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** Public tracks with their album and artist. Shared with search. */
  readyTracks(runner?: QueryRunner): SelectQueryBuilder<Track> {
    return this.tracks
      .createQueryBuilder('track', runner)
      .innerJoinAndSelect('track.album', 'album')
      .innerJoinAndSelect('track.artist', 'artist')
      .where('track.status = :ready', { ready: TrackStatus.Ready });
  }

  /** Artists with at least one public track. */
  visibleArtists(runner?: QueryRunner): SelectQueryBuilder<Artist> {
    return this.artists
      .createQueryBuilder('artist', runner)
      .where(hasReadyTrack('artist_id', '"artist"."id"'), { ready: TrackStatus.Ready });
  }

  /** Albums, with their artist, that have at least one public track. */
  visibleAlbums(runner?: QueryRunner): SelectQueryBuilder<Album> {
    return this.albums
      .createQueryBuilder('album', runner)
      .innerJoinAndSelect('album.artist', 'artist')
      .where(hasReadyTrack('album_id', '"album"."id"'), { ready: TrackStatus.Ready });
  }

  private newestFirst(query: SelectQueryBuilder<Album>): SelectQueryBuilder<Album> {
    return query
      .orderBy('album.releaseDate', 'DESC', 'NULLS LAST')
      .addOrderBy('album.createdAt', 'DESC')
      .addOrderBy('album.id', 'ASC');
  }
}
