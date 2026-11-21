import { describe, expect, it } from 'vitest';
import { isAdminActive } from './admin-nav';

describe('isAdminActive', () => {
  it('marks the dashboard only on /admin itself', () => {
    expect(isAdminActive('/admin', '/admin')).toBe(true);
    expect(isAdminActive('/admin/users', '/admin')).toBe(false);
  });

  it('marks a section on its nested pages', () => {
    expect(isAdminActive('/admin/albums/123', '/admin/albums')).toBe(true);
    expect(isAdminActive('/admin/artists', '/admin/albums')).toBe(false);
  });
});
