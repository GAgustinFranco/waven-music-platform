import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, ILike, Repository } from 'typeorm';
import { containsPattern } from '../../common/dto/pagination.dto.js';
import { detectAudioType, detectImageType, readHeader } from '../media/file-type.js';
import { MediaService } from '../media/media.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../storage/storage.types.js';
import {
  type CreateAlbumDto,
  type CreateArtistDto,
  type CreateTrackDto,
  type UpdateAlbumDto,
  type UpdateArtistDto,
  type UpdateTrackDto,
} from './dto/admin-catalog.dto.js';
import { Album } from './entities/album.entity.js';
import { Artist } from './entities/artist.entity.js';
import { CatalogSource } from './entities/catalog-source.js';
import { Track, TrackStatus } from './entities/track.entity.js';
import { uniqueSlug } from './slug.js';
import { TrackAudioService } from './track-audio.service.js';

export interface Page<T> {
  items: T[];
  total: number;
}

/** What the upload endpoints receive from multer. */
export interface UploadedAudio {
  path: string;
}

export interface UploadedImage {
  buffer: Buffer;
}

const fileRequired = () =>
  new BadRequestException({ code: 'FILE_REQUIRED', message: 'Send the file in the "file" field' });

/** Write side of the catalog, used by the admin endpoints and the import scripts. */
@Injectable()
export class AdminCatalogService {
  constructor(
    @InjectRepository(Artist) private readonly artists: Repository<Artist>,
    @InjectRepository(Album) private readonly albums: Repository<Album>,
    @InjectRepository(Track) private readonly tracks: Repository<Track>,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly media: MediaService,
    private readonly trackAudio: TrackAudioService,
  ) {}

  // ---------- Artists ----------

  async listArtists(limit: number, offset: number, q?: string): Promise<Page<Artist>> {
    const [items, total] = await this.artists.findAndCount({
      where: q ? { name: ILike(containsPattern(q)) } : {},
      order: { createdAt: 'DESC', id: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async getArtist(id: string): Promise<Artist> {
    const artist = await this.artists.findOneBy({ id });
    if (!artist) {
      throw new NotFoundException({ code: 'ARTIST_NOT_FOUND', message: 'Artist not found' });
    }
    return artist;
  }

  async createArtist(
    input: CreateArtistDto,
    origin: { source: CatalogSource; sourceId: string | null } = {
      source: CatalogSource.Upload,
      sourceId: null,
    },
  ): Promise<Artist> {
    const slug = await uniqueSlug(input.name, (candidate) =>
      this.artists.existsBy({ slug: candidate }),
    );
    return this.artists.save(
      this.artists.create({ name: input.name, bio: input.bio ?? null, slug, ...origin }),
    );
  }

  /** The slug is fixed at creation so shared links keep working after a rename. */
  async updateArtist(id: string, changes: UpdateArtistDto): Promise<Artist> {
    const artist = await this.getArtist(id);
    if (changes.name !== undefined) {
      artist.name = changes.name;
    }
    if (changes.bio !== undefined) {
      artist.bio = changes.bio;
    }
    return this.artists.save(artist);
  }

  async deleteArtist(id: string): Promise<void> {
    const artist = await this.getArtist(id);
    if (await this.albums.existsBy({ artistId: id })) {
      throw new ConflictException({
        code: 'ARTIST_HAS_ALBUMS',
        message: 'Delete the artist albums first',
      });
    }
    await this.artists.remove(artist);
    if (artist.imageKey) {
      await this.storage.delete(artist.imageKey);
    }
  }

  async setArtistImage(id: string, file: UploadedImage | undefined): Promise<Artist> {
    const artist = await this.getArtist(id);
    const { key } = await this.storeImage(file);
    const previous = artist.imageKey;
    artist.imageKey = key;
    const saved = await this.artists.save(artist);
    if (previous) {
      await this.storage.delete(previous);
    }
    return saved;
  }

  // ---------- Albums ----------

  async listAlbums(
    limit: number,
    offset: number,
    filter: { artistId?: string; q?: string } = {},
  ): Promise<Page<Album>> {
    const where: FindOptionsWhere<Album> = {};
    if (filter.artistId) where.artistId = filter.artistId;
    if (filter.q) where.title = ILike(containsPattern(filter.q));
    const [items, total] = await this.albums.findAndCount({
      where,
      relations: { artist: true },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async getAlbum(id: string): Promise<Album> {
    const album = await this.albums.findOne({ where: { id }, relations: { artist: true } });
    if (!album) {
      throw new NotFoundException({ code: 'ALBUM_NOT_FOUND', message: 'Album not found' });
    }
    return album;
  }

  async createAlbum(
    input: CreateAlbumDto,
    origin: { source: CatalogSource; sourceId: string | null } = {
      source: CatalogSource.Upload,
      sourceId: null,
    },
  ): Promise<Album> {
    const artist = await this.getArtist(input.artistId);
    const slug = await uniqueSlug(input.title, (candidate) =>
      this.albums.existsBy({ artistId: artist.id, slug: candidate }),
    );
    const album = await this.albums.save(
      this.albums.create({
        artistId: artist.id,
        title: input.title,
        slug,
        releaseDate: input.releaseDate ?? null,
        ...origin,
      }),
    );
    album.artist = artist;
    return album;
  }

  async updateAlbum(id: string, changes: UpdateAlbumDto): Promise<Album> {
    const album = await this.getAlbum(id);
    if (changes.title !== undefined) {
      album.title = changes.title;
    }
    if (changes.releaseDate !== undefined) {
      album.releaseDate = changes.releaseDate;
    }
    return this.albums.save(album);
  }

  /** Soft-deleted tracks still count: playlists keep showing them as unavailable. */
  async deleteAlbum(id: string): Promise<void> {
    const album = await this.getAlbum(id);
    if (await this.tracks.exists({ where: { albumId: id }, withDeleted: true })) {
      throw new ConflictException({
        code: 'ALBUM_HAS_TRACKS',
        message: 'Albums with tracks cannot be deleted',
      });
    }
    await this.albums.remove(album);
    if (album.coverKey) {
      await this.storage.delete(album.coverKey);
    }
  }

  async setAlbumCover(id: string, file: UploadedImage | undefined): Promise<Album> {
    const album = await this.getAlbum(id);
    const { key, dominantColor } = await this.storeImage(file);
    const previous = album.coverKey;
    album.coverKey = key;
    album.dominantColor = dominantColor;
    const saved = await this.albums.save(album);
    if (previous) {
      await this.storage.delete(previous);
    }
    return saved;
  }

  // ---------- Tracks ----------

  async listTracks(
    limit: number,
    offset: number,
    filter: { albumId?: string; q?: string } = {},
  ): Promise<Page<Track>> {
    const where: FindOptionsWhere<Track> = {};
    if (filter.albumId) where.albumId = filter.albumId;
    if (filter.q) where.title = ILike(containsPattern(filter.q));
    const [items, total] = await this.tracks.findAndCount({
      where,
      relations: { album: true, artist: true },
      order: filter.albumId ? { trackNumber: 'ASC', id: 'ASC' } : { createdAt: 'DESC', id: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async getTrack(id: string): Promise<Track> {
    const track = await this.tracks.findOne({
      where: { id },
      relations: { album: true, artist: true },
    });
    if (!track) {
      throw new NotFoundException({ code: 'TRACK_NOT_FOUND', message: 'Track not found' });
    }
    return track;
  }

  async createTrack(
    input: CreateTrackDto,
    origin: { source: CatalogSource; sourceId: string | null } = {
      source: CatalogSource.Upload,
      sourceId: null,
    },
  ): Promise<Track> {
    const album = await this.getAlbum(input.albumId);
    const track = await this.tracks.save(
      this.tracks.create({
        albumId: album.id,
        artistId: album.artistId,
        title: input.title,
        trackNumber: input.trackNumber,
        license: input.license ?? null,
        attributionUrl: input.attributionUrl ?? null,
        status: TrackStatus.Pending,
        ...origin,
      }),
    );
    track.album = album;
    track.artist = album.artist;
    return track;
  }

  async updateTrack(id: string, changes: UpdateTrackDto): Promise<Track> {
    const track = await this.getTrack(id);
    if (changes.title !== undefined) {
      track.title = changes.title;
    }
    if (changes.trackNumber !== undefined) {
      track.trackNumber = changes.trackNumber;
    }
    if (changes.license !== undefined) {
      track.license = changes.license;
    }
    if (changes.attributionUrl !== undefined) {
      track.attributionUrl = changes.attributionUrl;
    }
    return this.tracks.save(track);
  }

  /** Soft delete: the row and its audio stay so playlists can show it as unavailable. */
  async deleteTrack(id: string): Promise<void> {
    await this.getTrack(id);
    await this.tracks.softDelete({ id });
  }

  /** Validates the upload and starts transcoding; the track is `ready` once both qualities exist. */
  async uploadTrackAudio(id: string, file: UploadedAudio | undefined): Promise<Track> {
    if (!file) {
      throw fileRequired();
    }
    try {
      const track = await this.getTrack(id);
      if (track.status === TrackStatus.Processing) {
        throw new ConflictException({
          code: 'TRACK_PROCESSING',
          message: 'The previous upload is still being processed',
        });
      }
      if (!detectAudioType(await readHeader(file.path))) {
        throw invalidType('mp3, flac, wav or ogg');
      }
      await this.trackAudio.enqueue(track, file.path);
      return track;
    } catch (error: unknown) {
      await rm(file.path, { force: true });
      throw error;
    }
  }

  /** Processes an image upload into WebP variants under a new `images/<uuid>` prefix. */
  async storeImage(
    file: UploadedImage | undefined,
  ): Promise<{ key: string; dominantColor: string }> {
    if (!file) {
      throw fileRequired();
    }
    if (!detectImageType(file.buffer)) {
      throw invalidType('jpg, png or webp');
    }
    const processed = await this.media.processImage(file.buffer).catch(() => {
      throw invalidType('jpg, png or webp');
    });
    const key = `images/${randomUUID()}`;
    for (const variant of processed.variants) {
      await this.storage.put(`${key}/${variant.size}.webp`, variant.data, 'image/webp');
    }
    return { key, dominantColor: processed.dominantColor };
  }
}

function invalidType(allowed: string): UnsupportedMediaTypeException {
  return new UnsupportedMediaTypeException({
    code: 'INVALID_FILE_TYPE',
    message: `Unsupported file type; expected ${allowed}`,
  });
}
