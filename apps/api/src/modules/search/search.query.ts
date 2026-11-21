import { SearchHitType } from './search.dto.js';

/**
 * Minimum `word_similarity` for the `<%` operator. The pg_trgm default (0.6)
 * misses one-letter typos in short words ("caffe" → "Café" scores 0.57).
 */
export const WORD_SIMILARITY_THRESHOLD = 0.5;

/** Escapes `LIKE` wildcards so user input only ever matches literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** The normalized form every query compares; it must match the GIN index expression. */
export const normalized = (column: string) => `f_unaccent(lower(${column}))`;

/**
 * SQL that matches and scores `column` against the `:q`, `:prefix` and
 * `:contains` parameters (see `searchParams`). Substring matches are always
 * kept; fuzzy ones need a close word. Exact and prefix matches rank first.
 */
export function matchSql(column: string): { where: string; score: string } {
  const value = normalized(column);
  const q = normalized(':q');
  return {
    where: `(${value} LIKE ${normalized(':contains')} OR ${q} <% ${value})`,
    score: `word_similarity(${q}, ${value}) + CASE
      WHEN ${value} = ${q} THEN 1
      WHEN ${value} LIKE ${normalized(':prefix')} THEN 0.5
      WHEN ${value} LIKE ${normalized(':contains')} THEN 0.25
      ELSE 0 END`,
  };
}

export function searchParams(q: string): { q: string; prefix: string; contains: string } {
  const literal = escapeLike(q);
  return { q, prefix: `${literal}%`, contains: `%${literal}%` };
}

export interface ScoredHit {
  type: SearchHitType;
  id: string;
  score: number;
}

/**
 * The highest-scoring hit. Ties go to artists, then albums, then tracks: an
 * exact artist name is the most likely intent.
 */
export function pickTopResult(hits: ScoredHit[]): { type: SearchHitType; id: string } | null {
  const rank = { [SearchHitType.Artist]: 0, [SearchHitType.Album]: 1, [SearchHitType.Track]: 2 };
  let best: ScoredHit | null = null;
  for (const hit of hits) {
    if (
      !best ||
      hit.score > best.score ||
      (hit.score === best.score && rank[hit.type] < rank[best.type])
    ) {
      best = hit;
    }
  }
  return best ? { type: best.type, id: best.id } : null;
}
