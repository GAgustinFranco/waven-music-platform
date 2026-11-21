'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { applyFavorite, libraryKeys, moveEntry, type PlaylistDetail } from '@/lib/api/library';
import { toApiError } from '@/lib/api/queries';
import { broadcastLibraryChange } from './library-sync';

/** Refetches here and in the other tabs. */
function invalidate(queryClient: QueryClient, queryKey: readonly unknown[]) {
  void queryClient.invalidateQueries({ queryKey });
  broadcastLibraryChange(queryKey);
}

async function postTracks(id: string, trackIds: string[], position?: number) {
  const { data, error, response } = await api.POST('/playlists/{id}/tracks', {
    params: { path: { id } },
    body: { trackIds, position },
  });
  if (!data) {
    throw toApiError(error, response);
  }
  return data;
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trackIds }: { trackIds?: string[] } = {}): Promise<PlaylistDetail> => {
      const { data, error, response } = await api.POST('/playlists', { body: {} });
      if (!data) {
        throw toApiError(error, response);
      }
      return trackIds && trackIds.length > 0 ? postTracks(data.id, trackIds) : data;
    },
    onSuccess: (playlist) => {
      queryClient.setQueryData(libraryKeys.playlist(playlist.id), playlist);
      invalidate(queryClient, libraryKeys.myPlaylists());
    },
  });
}

export function useUpdatePlaylist(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; description: string | null }) => {
      const { data, error, response } = await api.PATCH('/playlists/{id}', {
        params: { path: { id } },
        body,
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    onSuccess: (playlist) => {
      queryClient.setQueryData(libraryKeys.playlist(id), playlist);
      invalidate(queryClient, libraryKeys.playlists());
    },
  });
}

export function useDeletePlaylist(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await api.DELETE('/playlists/{id}', {
        params: { path: { id } },
      });
      if (!response.ok) {
        throw toApiError(error, response);
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: libraryKeys.playlist(id) });
      invalidate(queryClient, libraryKeys.playlists());
    },
  });
}

export function useAddToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, trackIds }: { playlistId: string; trackIds: string[] }) =>
      postTracks(playlistId, trackIds),
    onSuccess: (playlist) => {
      queryClient.setQueryData(libraryKeys.playlist(playlist.id), playlist);
      invalidate(queryClient, libraryKeys.playlists());
    },
  });
}

/**
 * Shared shape of the optimistic entry edits: they change the cached playlist
 * at once, roll back on error, and only take the server's copy when no other
 * edit of the same playlist is still in flight (or a slow answer would undo a
 * newer drag).
 */
function useOptimisticEntryEdit<Variables>(
  playlistId: string,
  request: (variables: Variables) => Promise<PlaylistDetail>,
  apply: (playlist: PlaylistDetail, variables: Variables) => PlaylistDetail,
) {
  const queryClient = useQueryClient();
  const key = libraryKeys.playlist(playlistId);
  const mutationKey = [...key, 'entries'];
  return useMutation({
    mutationKey,
    mutationFn: request,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PlaylistDetail>(key);
      if (previous) {
        queryClient.setQueryData(key, apply(previous, variables));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSuccess: (playlist) => {
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        queryClient.setQueryData(key, playlist);
      }
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        invalidate(queryClient, libraryKeys.playlists());
      }
    },
  });
}

export function useMoveEntry(playlistId: string) {
  return useOptimisticEntryEdit(
    playlistId,
    async ({ entryId, to }: { entryId: string; from: number; to: number }) => {
      const { data, error, response } = await api.PATCH(
        '/playlists/{id}/tracks/{entryId}/position',
        { params: { path: { id: playlistId, entryId } }, body: { position: to } },
      );
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    (playlist, { from, to }) => ({ ...playlist, entries: moveEntry(playlist.entries, from, to) }),
  );
}

export function useRemoveEntry(playlistId: string) {
  return useOptimisticEntryEdit(
    playlistId,
    async ({ entryId }: { entryId: string }) => {
      const { data, error, response } = await api.DELETE('/playlists/{id}/tracks/{entryId}', {
        params: { path: { id: playlistId, entryId } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    (playlist, { entryId }) => {
      const entries = playlist.entries
        .filter((entry) => entry.id !== entryId)
        .map((entry, position) => ({ ...entry, position }));
      return { ...playlist, entries, trackCount: entries.length };
    },
  );
}

const FAVORITES_MUTATION = [...libraryKeys.favorites(), 'toggle'];

/** Optimistic heart: every cached "is it liked?" answer flips at once. */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const containsPrefix = [...libraryKeys.favorites(), 'contains'];
  return useMutation({
    mutationKey: FAVORITES_MUTATION,
    mutationFn: async ({ trackId, liked }: { trackId: string; liked: boolean }) => {
      const params = { params: { path: { trackId } } };
      const { error, response } = liked
        ? await api.PUT('/me/favorites/{trackId}', params)
        : await api.DELETE('/me/favorites/{trackId}', params);
      if (!response.ok) {
        throw toApiError(error, response);
      }
    },
    onMutate: async ({ trackId, liked }) => {
      await queryClient.cancelQueries({ queryKey: containsPrefix });
      const snapshot = queryClient.getQueriesData<string[]>({ queryKey: containsPrefix });
      for (const [key, data] of snapshot) {
        const askedFor = key[3];
        if (data && Array.isArray(askedFor)) {
          queryClient.setQueryData(key, applyFavorite(data, askedFor as string[], trackId, liked));
        }
      }
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: FAVORITES_MUTATION }) <= 1) {
        invalidate(queryClient, libraryKeys.favorites());
      }
    },
  });
}
