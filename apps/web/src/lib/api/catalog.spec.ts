import { describe, expect, it } from 'vitest';
import { catalogKeys, isNotFound, isUuid } from './catalog';
import { ApiError } from './queries';

describe('catalogKeys', () => {
  it('nests every key under the catalog root so it can be invalidated at once', () => {
    expect(catalogKeys.home()).toEqual(['catalog', 'home']);
    expect(catalogKeys.artist('a')).toEqual(['catalog', 'artists', 'a']);
    expect(catalogKeys.album('b')).toEqual(['catalog', 'albums', 'b']);
    expect(catalogKeys.album('b').slice(0, 2)).toEqual(catalogKeys.albums());
  });
});

describe('isUuid', () => {
  it('accepts UUIDs and rejects anything else', () => {
    expect(isUuid('3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});

describe('isNotFound', () => {
  it('treats 404 and 400 API errors as missing resources', () => {
    expect(isNotFound(new ApiError(404, 'NOT_FOUND', 'Not found'))).toBe(true);
    expect(isNotFound(new ApiError(400, 'BAD_REQUEST', 'Bad id'))).toBe(true);
  });

  it('does not hide server or network errors', () => {
    expect(isNotFound(new ApiError(500, 'HTTP_ERROR', 'Boom'))).toBe(false);
    expect(isNotFound(new Error('offline'))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});
