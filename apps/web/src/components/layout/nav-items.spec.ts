import { describe, expect, it } from 'vitest';
import { isActive } from './nav-items';

describe('isActive', () => {
  it('matches Home only on the root path', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/albums/x', '/')).toBe(false);
  });

  it('matches a section and its nested pages', () => {
    expect(isActive('/library', '/library')).toBe(true);
    expect(isActive('/library/playlists/1', '/library')).toBe(true);
    expect(isActive('/libraryx', '/library')).toBe(false);
  });
});
