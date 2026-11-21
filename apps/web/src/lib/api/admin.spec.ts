import { describe, expect, it } from 'vitest';
import {
  adminKeys,
  cleanParams,
  pageInfo,
  uploadErrorMessage,
  uploadHint,
  validateUpload,
} from './admin';
import { ApiError } from './queries';

const MB = 1024 * 1024;

describe('cleanParams', () => {
  it('drops empty filters so equivalent queries share a cache key', () => {
    const params = cleanParams({ q: '', role: undefined, limit: 20, offset: 0 });
    expect(params).toEqual({ limit: 20, offset: 0 });
    expect(adminKeys.userList(params)).toEqual(adminKeys.userList({ limit: 20, offset: 0 }));
  });

  it('keeps zero and real values', () => {
    expect(cleanParams({ q: 'ana', offset: 0 })).toEqual({ q: 'ana', offset: 0 });
  });
});

describe('adminKeys', () => {
  it('nests every key under the admin prefix for broad invalidation', () => {
    expect(adminKeys.track('t1').slice(0, 2)).toEqual([...adminKeys.tracks()]);
    expect(adminKeys.stats(14).slice(0, 2)).toEqual([...adminKeys.allStats()]);
    expect(adminKeys.album('a1')[0]).toBe('admin');
  });
});

describe('validateUpload', () => {
  it('accepts the allowed types within the limits (business rule 10)', () => {
    expect(validateUpload({ name: 'Cover.JPG', size: 2 * MB }, 'image')).toBeNull();
    expect(validateUpload({ name: 'song.flac', size: 99 * MB }, 'audio')).toBeNull();
  });

  it('rejects other types', () => {
    expect(validateUpload({ name: 'cover.gif', size: MB }, 'image')).toBe(
      'Choose a JPG, PNG or WebP file.',
    );
    expect(validateUpload({ name: 'song.m4a', size: MB }, 'audio')).toMatch(/MP3, FLAC/);
  });

  it('rejects files over the limit and empty files', () => {
    expect(validateUpload({ name: 'cover.png', size: 5 * MB + 1 }, 'image')).toBe(
      'The file is larger than 5 MB.',
    );
    expect(validateUpload({ name: 'song.mp3', size: 101 * MB }, 'audio')).toBe(
      'The file is larger than 100 MB.',
    );
    expect(validateUpload({ name: 'song.mp3', size: 0 }, 'audio')).toBe('The file is empty.');
  });

  it('describes the rules for the field hint', () => {
    expect(uploadHint('audio')).toBe('MP3, FLAC, WAV or OGG up to 100 MB');
  });
});

describe('uploadErrorMessage', () => {
  it('maps status codes to readable messages', () => {
    expect(uploadErrorMessage(new ApiError(415, 'UNSUPPORTED', 'x'))).toBe(
      'That file type is not supported.',
    );
    expect(uploadErrorMessage(new ApiError(0, 'NETWORK_ERROR', 'x'))).toMatch(/connection/);
    expect(uploadErrorMessage(new Error('boom'))).toBe('The upload failed. Try again.');
  });
});

describe('pageInfo', () => {
  it('summarizes the first page', () => {
    expect(pageInfo(45, 0, 20)).toEqual({
      page: 1,
      pages: 3,
      from: 1,
      to: 20,
      hasPrev: false,
      hasNext: true,
    });
  });

  it('summarizes the last, partial page', () => {
    expect(pageInfo(45, 40, 20)).toMatchObject({ page: 3, from: 41, to: 45, hasNext: false });
  });

  it('handles an empty table', () => {
    expect(pageInfo(0, 0, 20)).toEqual({
      page: 1,
      pages: 1,
      from: 0,
      to: 0,
      hasPrev: false,
      hasNext: false,
    });
  });
});
