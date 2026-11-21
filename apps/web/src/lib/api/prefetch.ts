import type { QueryClient } from '@tanstack/react-query';
import { albumQuery, artistQuery, isUuid } from './catalog';
import { playlistQuery } from './library';

type Prefetch = (queryClient: QueryClient) => Promise<void>;

const DETAIL = /^\/(albums|artists|playlists)\/([^/?#]+)$/;

/**
 * The detail query a link leads to, so hovering or focusing the link can warm
 * the cache before the click. Only album, artist and playlist pages qualify;
 * anything else (or a malformed id) returns null.
 */
export function prefetchForHref(href: string): Prefetch | null {
  const match = DETAIL.exec(href);
  const id = match?.[2];
  if (!match || !id || !isUuid(id)) {
    return null;
  }
  switch (match[1]) {
    case 'albums':
      return (queryClient) => queryClient.prefetchQuery(albumQuery(id));
    case 'artists':
      return (queryClient) => queryClient.prefetchQuery(artistQuery(id));
    default:
      return (queryClient) => queryClient.prefetchQuery(playlistQuery(id));
  }
}
