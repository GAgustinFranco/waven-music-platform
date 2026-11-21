import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import {
  type AdminAlbumDto,
  type AdminArtistDto,
  type AdminTrackDto,
} from './dto/admin-catalog.dto.js';
import {
  type AlbumRefDto,
  type AlbumSummaryDto,
  type ArtistRefDto,
  type ArtistSummaryDto,
  type ImageSetDto,
  type TrackDto,
} from './dto/catalog.dto.js';
import { type Album } from './entities/album.entity.js';
import { type Artist } from './entities/artist.entity.js';
import { type Track } from './entities/track.entity.js';

/** Turns catalog entities into response DTOs with public image URLs. */
@Injectable()
export class CatalogMapper {
  private readonly mediaBaseUrl: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.mediaBaseUrl = config.get('MEDIA_PUBLIC_URL', { infer: true }).replace(/\/+$/, '');
  }

  imageSet(key: string | null): ImageSetDto | null {
    if (!key) {
      return null;
    }
    const url = (size: number) => `${this.mediaBaseUrl}/${key}/${size}.webp`;
    return { sm: url(64), md: url(300), lg: url(640) };
  }

  artistRef(artist: Artist): ArtistRefDto {
    return { id: artist.id, name: artist.name, slug: artist.slug };
  }

  artistSummary(artist: Artist): ArtistSummaryDto {
    return { ...this.artistRef(artist), image: this.imageSet(artist.imageKey) };
  }

  albumRef(album: Album): AlbumRefDto {
    return {
      id: album.id,
      title: album.title,
      slug: album.slug,
      cover: this.imageSet(album.coverKey),
    };
  }

  /** Needs `album.artist` loaded. */
  albumSummary(album: Album): AlbumSummaryDto {
    return {
      id: album.id,
      title: album.title,
      slug: album.slug,
      releaseDate: album.releaseDate,
      cover: this.imageSet(album.coverKey),
      dominantColor: album.dominantColor,
      artist: this.artistRef(required(album.artist, 'album.artist')),
    };
  }

  /** Needs `track.album` and `track.artist` loaded. */
  track(track: Track): TrackDto {
    return {
      id: track.id,
      title: track.title,
      trackNumber: track.trackNumber,
      durationMs: track.durationMs ?? 0,
      artist: this.artistRef(required(track.artist, 'track.artist')),
      album: this.albumRef(required(track.album, 'track.album')),
      license: track.license,
      attributionUrl: track.attributionUrl,
    };
  }

  adminArtist(artist: Artist): AdminArtistDto {
    return {
      ...this.artistSummary(artist),
      bio: artist.bio,
      source: artist.source,
      createdAt: artist.createdAt.toISOString(),
    };
  }

  adminAlbum(album: Album): AdminAlbumDto {
    return {
      ...this.albumSummary(album),
      source: album.source,
      createdAt: album.createdAt.toISOString(),
    };
  }

  adminTrack(track: Track): AdminTrackDto {
    return {
      id: track.id,
      title: track.title,
      trackNumber: track.trackNumber,
      durationMs: track.durationMs,
      status: track.status,
      artist: this.artistRef(required(track.artist, 'track.artist')),
      album: this.albumRef(required(track.album, 'track.album')),
      license: track.license,
      attributionUrl: track.attributionUrl,
      playCount: track.playCount,
      source: track.source,
      createdAt: track.createdAt.toISOString(),
    };
  }
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`${name} must be loaded`);
  }
  return value;
}
