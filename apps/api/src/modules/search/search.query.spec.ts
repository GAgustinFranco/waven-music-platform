import { SearchHitType } from './search.dto.js';
import { escapeLike, matchSql, pickTopResult, searchParams } from './search.query.js';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLike('100%_off\\')).toBe('100\\%\\_off\\\\');
    expect(escapeLike('café')).toBe('café');
  });
});

describe('searchParams', () => {
  it('builds literal prefix and substring patterns', () => {
    expect(searchParams('a_b')).toEqual({ q: 'a_b', prefix: 'a\\_b%', contains: '%a\\_b%' });
  });
});

describe('matchSql', () => {
  it('compares the same expression the GIN index is built on', () => {
    const { where, score } = matchSql('"track"."title"');

    expect(where).toContain('f_unaccent(lower("track"."title")) LIKE');
    expect(where).toContain('f_unaccent(lower(:q)) <% f_unaccent(lower("track"."title"))');
    expect(score).toContain('word_similarity(f_unaccent(lower(:q)), f_unaccent(lower(');
  });
});

describe('pickTopResult', () => {
  it('returns null without hits', () => {
    expect(pickTopResult([])).toBeNull();
  });

  it('picks the highest score across types', () => {
    expect(
      pickTopResult([
        { type: SearchHitType.Artist, id: 'ar', score: 0.4 },
        { type: SearchHitType.Track, id: 'tr', score: 1.5 },
        { type: SearchHitType.Album, id: 'al', score: 0.9 },
      ]),
    ).toEqual({ type: SearchHitType.Track, id: 'tr' });
  });

  it('prefers artists, then albums, on a tie', () => {
    expect(
      pickTopResult([
        { type: SearchHitType.Track, id: 'tr', score: 2 },
        { type: SearchHitType.Album, id: 'al', score: 2 },
        { type: SearchHitType.Artist, id: 'ar', score: 2 },
      ]),
    ).toEqual({ type: SearchHitType.Artist, id: 'ar' });
  });
});
