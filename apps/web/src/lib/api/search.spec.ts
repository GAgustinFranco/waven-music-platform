import { describe, expect, it } from 'vitest';
import { isSearchType, normalizeQuery, searchHref, searchKeys } from './search';

describe('search helpers', () => {
  it('normalizes the query like the API', () => {
    expect(normalizeQuery('  café  ')).toBe('café');
    expect(normalizeQuery('x'.repeat(150))).toHaveLength(100);
  });

  it('shares one cache entry per normalized, case-insensitive query', () => {
    expect(searchKeys.results(' Café ', 'all')).toEqual(searchKeys.results('café', 'all'));
    expect(searchKeys.results('café', 'track')).not.toEqual(searchKeys.results('café', 'all'));
  });

  it('recognizes only the API types', () => {
    expect(isSearchType('album')).toBe(true);
    expect(isSearchType('song')).toBe(false);
    expect(isSearchType(null)).toBe(false);
  });

  it('builds the URL, omitting the defaults', () => {
    expect(searchHref('', 'all')).toBe('/search');
    expect(searchHref(' café & co ', 'all')).toBe('/search?q=caf%C3%A9+%26+co');
    expect(searchHref('rock', 'artist')).toBe('/search?q=rock&type=artist');
  });
});
