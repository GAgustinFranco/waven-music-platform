import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { catalogKeys } from './catalog';
import { libraryKeys } from './library';
import { prefetchForHref } from './prefetch';

const ID = '0b7d6a52-3c2e-4f7a-9d55-8a1c2b3d4e5f';

describe('prefetchForHref', () => {
  it.each(['/', '/search?q=x', '/library', `/albums/${ID}/extra`, '/albums/not-a-uuid'])(
    'ignores %s',
    (href) => {
      expect(prefetchForHref(href)).toBeNull();
    },
  );

  it.each([
    [`/albums/${ID}`, catalogKeys.album(ID)],
    [`/artists/${ID}`, catalogKeys.artist(ID)],
    [`/playlists/${ID}`, libraryKeys.playlist(ID)],
  ])('prefetches the detail query of %s', async (href, queryKey) => {
    const queryClient = new QueryClient();
    const prefetchQuery = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue();
    await prefetchForHref(href)?.(queryClient);
    expect(prefetchQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey }));
  });
});
