'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type AdminAlbum,
  type AdminArtist,
  adminKeys,
  type AdminTrack,
  type CreateAlbum,
  type CreateArtist,
  type CreateTrack,
  type Role,
  type UpdateAlbum,
  type UpdateArtist,
  type UpdateTrack,
  uploadAlbumCover,
  uploadArtistImage,
  uploadErrorMessage,
  uploadTrackAudio,
  type UploadOptions,
} from '@/lib/api/admin';
import { api } from '@/lib/api/client';
import { catalogKeys } from '@/lib/api/catalog';
import { ApiError, meKeys, toApiError } from '@/lib/api/queries';
import { searchKeys } from '@/lib/api/search';

function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data === undefined) {
    throw toApiError(result.error, result.response);
  }
  return result.data;
}

/** Catalog edits also change what the public pages and search show. */
function invalidateCatalog(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: adminKeys.all }),
    queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
    queryClient.invalidateQueries({ queryKey: searchKeys.all }),
  ]);
}

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.statusCode < 500 && error.message ? error.message : fallback;

// ---------- Users ----------

export function useChangeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) =>
      unwrap(await api.PATCH('/admin/users/{id}', { params: { path: { id } }, body: { role } })),
    onSuccess: (user) => {
      toast.success(`${user.displayName} is now ${user.role === 'admin' ? 'an admin' : 'a user'}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError && error.code === 'CANNOT_DEMOTE_SELF'
          ? "You can't remove your own admin role."
          : "Couldn't change the role. Try again.",
      );
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.allStats() }),
        queryClient.invalidateQueries({ queryKey: meKeys.all }),
      ]),
  });
}

// ---------- Catalog ----------

export function useSaveArtist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: CreateArtist | UpdateArtist }) =>
      id
        ? unwrap(await api.PATCH('/admin/artists/{id}', { params: { path: { id } }, body }))
        : unwrap(await api.POST('/admin/artists', { body: body as CreateArtist })),
    onSettled: () => invalidateCatalog(queryClient),
  });
}

export function useSaveAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: CreateAlbum | UpdateAlbum }) =>
      id
        ? unwrap(await api.PATCH('/admin/albums/{id}', { params: { path: { id } }, body }))
        : unwrap(await api.POST('/admin/albums', { body: body as CreateAlbum })),
    onSettled: () => invalidateCatalog(queryClient),
  });
}

export function useSaveTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: CreateTrack | UpdateTrack }) =>
      id
        ? unwrap(await api.PATCH('/admin/tracks/{id}', { params: { path: { id } }, body }))
        : unwrap(await api.POST('/admin/tracks', { body: body as CreateTrack })),
    onSettled: () => invalidateCatalog(queryClient),
  });
}

export type DeletableKind = 'artist' | 'album' | 'track';

const DELETE_CONFLICTS: Record<string, string> = {
  ARTIST_HAS_ALBUMS: 'Delete the albums of this artist first.',
  ALBUM_HAS_TRACKS: 'Albums with tracks cannot be deleted, because playlists may reference them.',
};

export function useDeleteCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id }: { kind: DeletableKind; id: string }) => {
      const params = { params: { path: { id } } };
      const result =
        kind === 'artist'
          ? await api.DELETE('/admin/artists/{id}', params)
          : kind === 'album'
            ? await api.DELETE('/admin/albums/{id}', params)
            : await api.DELETE('/admin/tracks/{id}', params);
      if (!result.response.ok) {
        throw toApiError(result.error, result.response);
      }
    },
    onSuccess: (_data, { kind }) =>
      toast.success(`${kind[0]?.toUpperCase()}${kind.slice(1)} deleted`),
    onError: (error) =>
      toast.error(
        (error instanceof ApiError && DELETE_CONFLICTS[error.code]) ||
          "Couldn't delete it. Try again.",
      ),
    onSettled: () => invalidateCatalog(queryClient),
  });
}

export type UploadTarget =
  | { kind: 'artist-image'; id: string }
  | { kind: 'album-cover'; id: string }
  | { kind: 'track-audio'; id: string };

/** Uploads a file with progress; a track upload leaves the track `processing`. */
export function useUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      target,
      file,
      options,
    }: {
      target: UploadTarget;
      file: File;
      options?: UploadOptions;
    }): Promise<AdminArtist | AdminAlbum | AdminTrack> => {
      switch (target.kind) {
        case 'artist-image':
          return uploadArtistImage(target.id, file, options);
        case 'album-cover':
          return uploadAlbumCover(target.id, file, options);
        case 'track-audio':
          return uploadTrackAudio(target.id, file, options);
      }
    },
    onSuccess: (result, { target }) => {
      if (target.kind === 'track-audio') {
        queryClient.setQueryData(adminKeys.track(target.id), result as AdminTrack);
      }
    },
    onError: (error) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.error(uploadErrorMessage(error));
      }
    },
    onSettled: () => invalidateCatalog(queryClient),
  });
}
