import { describe, expect, it } from 'vitest';
import { applyFavorite, libraryKeys, moveEntry, type PlaylistEntry } from './library';

const entry = (id: string, position: number): PlaylistEntry =>
  ({ id, position, addedAt: '', available: true, track: { id: `t-${id}` } }) as PlaylistEntry;

const ids = (entries: PlaylistEntry[]) => entries.map((item) => item.id);

describe('moveEntry', () => {
  const list = [entry('a', 0), entry('b', 1), entry('c', 2), entry('d', 3)];

  it('moves down and up, renumbering positions', () => {
    const down = moveEntry(list, 0, 2);
    expect(ids(down)).toEqual(['b', 'c', 'a', 'd']);
    expect(down.map((item) => item.position)).toEqual([0, 1, 2, 3]);

    expect(ids(moveEntry(list, 3, 1))).toEqual(['a', 'd', 'b', 'c']);
  });

  it('clamps the target like the API does', () => {
    expect(ids(moveEntry(list, 1, 99))).toEqual(['a', 'c', 'd', 'b']);
    expect(ids(moveEntry(list, 2, -5))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('returns the same list for no-ops and unknown sources', () => {
    expect(moveEntry(list, 1, 1)).toBe(list);
    expect(moveEntry(list, 7, 0)).toBe(list);
  });
});

describe('applyFavorite', () => {
  it('adds and removes only for lists that asked about the track', () => {
    expect(applyFavorite(['x'], ['x', 'y'], 'y', true)).toEqual(['x', 'y']);
    expect(applyFavorite(['x', 'y'], ['x', 'y'], 'x', false)).toEqual(['y']);
    expect(applyFavorite(['x'], ['x'], 'z', true)).toEqual(['x']);
  });

  it('never duplicates a liked id', () => {
    expect(applyFavorite(['y'], ['y'], 'y', true)).toEqual(['y']);
  });
});

describe('libraryKeys.favoritesContains', () => {
  it('shares one key for the same set of ids', () => {
    expect(libraryKeys.favoritesContains(['b', 'a', 'b'])).toEqual(
      libraryKeys.favoritesContains(['a', 'b']),
    );
  });
});
