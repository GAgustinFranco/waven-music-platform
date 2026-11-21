import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource, type Repository } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { AdminCatalogService } from '../../src/modules/catalog/admin-catalog.service.js';
import { Album } from '../../src/modules/catalog/entities/album.entity.js';
import { Artist } from '../../src/modules/catalog/entities/artist.entity.js';
import { type CatalogSource } from '../../src/modules/catalog/entities/catalog-source.js';
import { Track, TrackStatus } from '../../src/modules/catalog/entities/track.entity.js';
import { TrackAudioService } from '../../src/modules/catalog/track-audio.service.js';

/** Same precedence as the app: real env vars, then apps/api/.env, then the root .env. */
export function loadEnvFiles(): void {
  for (const file of ['.env', '../../.env']) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
    }
  }
}

export interface TrackInput {
  title: string;
  trackNumber: number;
  license: string | null;
  attributionUrl: string | null;
}

/**
 * Idempotent catalog writes for the import scripts. Rows are matched by
 * `(source, sourceId)`, so running a script twice does not duplicate anything.
 * Metadata writes run one at a time; only transcoding runs in parallel.
 */
export class CatalogIngester {
  private readonly artists: Repository<Artist>;
  private readonly albums: Repository<Album>;
  private readonly tracks: Repository<Track>;
  private readonly admin: AdminCatalogService;
  private readonly audio: TrackAudioService;
  private lock: Promise<unknown> = Promise.resolve();

  constructor(
    readonly app: INestApplicationContext,
    private readonly source: CatalogSource,
  ) {
    const dataSource = app.get(DataSource);
    this.artists = dataSource.getRepository(Artist);
    this.albums = dataSource.getRepository(Album);
    this.tracks = dataSource.getRepository(Track);
    this.admin = app.get(AdminCatalogService);
    this.audio = app.get(TrackAudioService);
  }

  /** Runs `fn` after every previously scheduled `serial` call has settled. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.lock.then(fn, fn);
    this.lock = result.catch(() => undefined);
    return result;
  }

  findTrack(sourceId: string): Promise<Track | null> {
    return this.tracks.findOne({ where: { source: this.source, sourceId }, withDeleted: true });
  }

  countReady(): Promise<number> {
    return this.tracks.countBy({ source: this.source, status: TrackStatus.Ready });
  }

  artist(sourceId: string, name: string, image?: () => Promise<Buffer | null>): Promise<Artist> {
    return this.serial(async () => {
      const artist =
        (await this.artists.findOneBy({ source: this.source, sourceId })) ??
        (await this.admin.createArtist({ name }, { source: this.source, sourceId }));
      if (!artist.imageKey && image) {
        const data = await image().catch(() => null);
        if (data) {
          return this.admin.setArtistImage(artist.id, { buffer: data }).catch(() => artist);
        }
      }
      return artist;
    });
  }

  album(
    sourceId: string,
    artist: Artist,
    title: string,
    releaseDate: string | null,
    cover?: () => Promise<Buffer | null>,
  ): Promise<Album> {
    return this.serial(async () => {
      const album =
        (await this.albums.findOneBy({ source: this.source, sourceId })) ??
        (await this.admin.createAlbum(
          { artistId: artist.id, title, releaseDate },
          { source: this.source, sourceId },
        ));
      if (!album.coverKey && cover) {
        const data = await cover().catch(() => null);
        if (data) {
          return this.admin.setAlbumCover(album.id, { buffer: data }).catch(() => album);
        }
      }
      return album;
    });
  }

  /**
   * Creates the track (or retries a failed one) and transcodes `audioPath`,
   * which is deleted afterwards. Resolves to `true` when the track is ready.
   */
  async track(
    sourceId: string,
    album: Album,
    input: TrackInput,
    audioPath: string,
  ): Promise<boolean> {
    const track = await this.serial(async () => {
      const existing = await this.findTrack(sourceId);
      if (existing) {
        return existing;
      }
      return this.admin.createTrack(
        { albumId: album.id, ...input },
        { source: this.source, sourceId },
      );
    });
    if (track.status === TrackStatus.Ready) {
      return true;
    }
    await this.tracks.update({ id: track.id }, { status: TrackStatus.Processing });
    await this.audio.process(track.id, audioPath);
    return true;
  }
}

export async function createCatalogContext(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
}

/** Runs `worker` over `items` with at most `concurrency` in flight; stops early when `shouldStop` says so. */
export async function runPool<T>(
  items: AsyncIterable<T> | Iterable<T>,
  concurrency: number,
  worker: (item: T) => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  const iterator =
    Symbol.asyncIterator in items
      ? items[Symbol.asyncIterator]()
      : (items as Iterable<T>)[Symbol.iterator]();
  const runners = Array.from({ length: concurrency }, async () => {
    while (!shouldStop()) {
      const next = await iterator.next();
      if (next.done) {
        return;
      }
      await worker(next.value);
    }
  });
  await Promise.all(runners);
}

/** Progress output; Nest's own logs are limited to warnings and errors. */
export const scriptLogger = {
  log: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
