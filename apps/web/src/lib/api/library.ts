import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from './client';
import { toApiError } from './queries';
import type { components } from './schema';

type Schemas = components['schemas'];
export type PlaylistSummary = Schemas['PlaylistSummaryDto'];
export type PlaylistDetail = Schemas['PlaylistDetailDto'];
export type PlaylistEntry = Schemas['PlaylistEntryDto'];
export type PlaylistPage = Schemas['PlaylistPageDto'];
export type Favorite = Schemas['FavoriteDto'];
export type FavoritePage = Schemas['FavoritePageDto'];

/** The API's page size cap; also the most playlists the sidebar lists. */
export const PAGE_SIZE = 50;

/** Query key factories for playlists and favorites (every library key is built here). */
export const libraryKeys = {
  all: ['library'] as const,
  playlists: () => [...libraryKeys.all, 'playlists'] as const,
  myPlaylists: () => [...libraryKeys.playlists(), 'mine'] as const,
  playlist: (id: string) => [...libraryKeys.playlists(), 'detail', id] as const,
  favorites: () => [...libraryKeys.all, 'favorites'] as const,
  favoriteList: () => [...libraryKeys.favorites(), 'list'] as const,
  /** One key per list of rows; ids are sorted so the same set shares a cache entry. */
  favoritesContains: (trackIds: readonly string[]) =>
    [...libraryKeys.favorites(), 'contains', [...new Set(trackIds)].sort()] as const,
};

export const myPlaylistsQuery = () =>
  queryOptions({
    queryKey: libraryKeys.myPlaylists(),
    queryFn: async (): Promise<PlaylistPage> => {
      const { data, error, response } = await api.GET('/me/playlists', {
        params: { query: { limit: PAGE_SIZE } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
  });

export const playlistQuery = (id: string) =>
  queryOptions({
    queryKey: libraryKeys.playlist(id),
    queryFn: async (): Promise<PlaylistDetail> => {
      const { data, error, response } = await api.GET('/playlists/{id}', {
        params: { path: { id } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
  });

export const favoritesQuery = () =>
  infiniteQueryOptions({
    queryKey: libraryKeys.favoriteList(),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<FavoritePage> => {
      const { data, error, response } = await api.GET('/me/favorites', {
        params: { query: { limit: PAGE_SIZE, offset: pageParam } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    getNextPageParam: (last) =>
      last.offset + last.items.length < last.total ? last.offset + last.items.length : undefined,
  });

/** Which of these tracks are liked; up to 50 ids, the API's cap. */
export const favoritesContainsQuery = (trackIds: readonly string[]) =>
  queryOptions({
    queryKey: libraryKeys.favoritesContains(trackIds),
    queryFn: async (): Promise<string[]> => {
      const ids = [...new Set(trackIds)].slice(0, PAGE_SIZE);
      if (ids.length === 0) {
        return [];
      }
      const { data, error, response } = await api.GET('/me/favorites/contains', {
        params: { query: { ids: ids.join(',') } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data.trackIds;
    },
  });

/**
 * Optimistic reorder: moves the entry at `from` to `to` and renumbers
 * positions, mirroring what the API does in its transaction.
 */
export function moveEntry(entries: PlaylistEntry[], from: number, to: number): PlaylistEntry[] {
  if (from === to || from < 0 || from >= entries.length) {
    return entries;
  }
  const target = Math.min(Math.max(to, 0), entries.length - 1);
  const next = [...entries];
  const [moved] = next.splice(from, 1);
  if (!moved) {
    return entries;
  }
  next.splice(target, 0, moved);
  return next.map((entry, position) => ({ ...entry, position }));
}

/** Optimistic like/unlike of a cached `contains` answer for the ids it was asked about. */
export function applyFavorite(
  liked: string[],
  askedFor: readonly string[],
  trackId: string,
  isLiked: boolean,
): string[] {
  if (!askedFor.includes(trackId)) {
    return liked;
  }
  const without = liked.filter((id) => id !== trackId);
  return isLiked ? [...without, trackId] : without;
}
