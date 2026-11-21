import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CatalogMapper } from '../catalog/catalog.mapper.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { isTrackAvailable } from '../catalog/entities/track.entity.js';
import { Favorite } from './favorite.entity.js';
import { type FavoritePageDto } from './favorites.dto.js';

/** Liking and unliking are idempotent, so the client can retry freely. */
@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    private readonly catalog: CatalogService,
    private readonly mapper: CatalogMapper,
  ) {}

  async list(userId: string, limit: number, offset: number): Promise<FavoritePageDto> {
    const [rows, total] = await this.favorites
      .createQueryBuilder('favorite')
      // A liked track that was later deleted is still listed, as unavailable. Must precede the joins.
      .withDeleted()
      .innerJoinAndSelect('favorite.track', 'track')
      .innerJoinAndSelect('track.album', 'album')
      .innerJoinAndSelect('track.artist', 'artist')
      .where('favorite.userId = :userId', { userId })
      .orderBy('favorite.createdAt', 'DESC')
      .addOrderBy('favorite.trackId', 'ASC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return {
      items: rows.map((row) => {
        if (!row.track) {
          throw new Error('favorite.track must be loaded');
        }
        return {
          addedAt: row.createdAt.toISOString(),
          available: isTrackAvailable(row.track),
          track: this.mapper.track(row.track),
        };
      }),
      total,
      limit,
      offset,
    };
  }

  async contains(userId: string, trackIds: string[]): Promise<string[]> {
    const rows = await this.favorites.find({
      select: { trackId: true },
      where: { userId, trackId: In(trackIds) },
    });
    const liked = new Set(rows.map((row) => row.trackId));
    return [...new Set(trackIds)].filter((id) => liked.has(id));
  }

  /** Only playable tracks can be liked (404 `TRACK_NOT_FOUND` otherwise). */
  async add(userId: string, trackId: string): Promise<void> {
    await this.catalog.findReadyTrack(trackId);
    await this.favorites
      .createQueryBuilder()
      .insert()
      .values({ userId, trackId })
      .orIgnore()
      .execute();
  }

  /** Unliking works on any track, deleted ones included. */
  async remove(userId: string, trackId: string): Promise<void> {
    await this.favorites.delete({ userId, trackId });
  }
}
