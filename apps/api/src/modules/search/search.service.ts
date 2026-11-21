import { Injectable } from '@nestjs/common';
import { DataSource, type ObjectLiteral, type QueryRunner, type SelectQueryBuilder } from 'typeorm';
import { CatalogMapper } from '../catalog/catalog.mapper.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { SearchHitType, type SearchResultsDto, SearchType } from './search.dto.js';
import {
  matchSql,
  pickTopResult,
  type ScoredHit,
  searchParams,
  WORD_SIMILARITY_THRESHOLD,
} from './search.query.js';

const EMPTY: SearchResultsDto = { tracks: [], albums: [], artists: [], topResult: null };

/**
 * Fuzzy, accent-insensitive search over the public catalog (ARCHITECTURE §3),
 * with the same visibility rules as browsing (SPEC §6.7).
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly mapper: CatalogMapper,
    private readonly dataSource: DataSource,
  ) {}

  async search(q: string, type: SearchType, limit: number): Promise<SearchResultsDto> {
    if (q === '') {
      return EMPTY;
    }
    const wants = (hit: SearchHitType) => type === SearchType.All || type === (hit as string);

    // The threshold is per transaction, so one connection runs the three lookups.
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query(`SELECT set_config('pg_trgm.word_similarity_threshold', $1, true)`, [
        String(WORD_SIMILARITY_THRESHOLD),
      ]);
      const artists = wants(SearchHitType.Artist) ? await this.artists(runner, q, limit) : [];
      const albums = wants(SearchHitType.Album) ? await this.albums(runner, q, limit) : [];
      const tracks = wants(SearchHitType.Track) ? await this.tracks(runner, q, limit) : [];
      await runner.commitTransaction();

      const hits: ScoredHit[] = [
        ...artists.map(({ entity, score }) => ({
          type: SearchHitType.Artist,
          id: entity.id,
          score,
        })),
        ...albums.map(({ entity, score }) => ({ type: SearchHitType.Album, id: entity.id, score })),
        ...tracks.map(({ entity, score }) => ({ type: SearchHitType.Track, id: entity.id, score })),
      ];
      return {
        artists: artists.map(({ entity }) => this.mapper.artistSummary(entity)),
        albums: albums.map(({ entity }) => this.mapper.albumSummary(entity)),
        tracks: tracks.map(({ entity }) => this.mapper.track(entity)),
        topResult: type === SearchType.All ? pickTopResult(hits) : null,
      };
    } catch (error) {
      if (runner.isTransactionActive) {
        await runner.rollbackTransaction();
      }
      throw error;
    } finally {
      await runner.release();
    }
  }

  private artists(runner: QueryRunner, q: string, limit: number) {
    return scored(
      this.catalog.visibleArtists(runner).addOrderBy('artist.name', 'ASC'),
      'artist',
      '"artist"."name"',
      q,
      limit,
    );
  }

  private albums(runner: QueryRunner, q: string, limit: number) {
    return scored(
      this.catalog
        .visibleAlbums(runner)
        .addOrderBy('album.releaseDate', 'DESC', 'NULLS LAST')
        .addOrderBy('album.title', 'ASC'),
      'album',
      '"album"."title"',
      q,
      limit,
    );
  }

  private tracks(runner: QueryRunner, q: string, limit: number) {
    return scored(
      this.catalog
        .readyTracks(runner)
        .addOrderBy('track.playCount', 'DESC')
        .addOrderBy('track.title', 'ASC'),
      'track',
      '"track"."title"',
      q,
      limit,
    );
  }
}

/**
 * Filters `query` to matches on `column`, best score first (the query's own
 * ordering breaks ties), and pairs each entity with its score. The query may
 * only join many-to-one relations, so `LIMIT` is exact and rows map 1:1.
 */
async function scored<T extends ObjectLiteral & { id: string }>(
  query: SelectQueryBuilder<T>,
  alias: string,
  column: string,
  q: string,
  limit: number,
): Promise<{ entity: T; score: number }[]> {
  const match = matchSql(column);
  const orderBys = query.expressionMap.orderBys;
  const { entities, raw } = await query
    .andWhere(match.where, searchParams(q))
    .addSelect(match.score, 'search_score')
    .orderBy({ search_score: 'DESC', ...orderBys })
    .limit(limit)
    .getRawAndEntities<Record<string, unknown>>();
  const scores = new Map(raw.map((row) => [row[`${alias}_id`], Number(row.search_score)]));
  return entities.map((entity) => ({ entity, score: scores.get(entity.id) ?? 0 }));
}
