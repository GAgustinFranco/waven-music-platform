import { queryOptions } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { api, API_BASE_URL, refreshAccessToken } from './client';
import { ApiError, toApiError } from './queries';
import type { components, operations } from './schema';

type Schemas = components['schemas'];
export type AdminUser = Schemas['UserDto'];
export type Role = AdminUser['role'];
export type AdminSubscription = Schemas['AdminSubscriptionDto'];
export type SubscriptionStatus = AdminSubscription['status'];
export type AdminStats = Schemas['AdminStatsDto'];
export type AdminArtist = Schemas['AdminArtistDto'];
export type AdminAlbum = Schemas['AdminAlbumDto'];
export type AdminTrack = Schemas['AdminTrackDto'];
export type TrackStatus = AdminTrack['status'];
export type CreateArtist = Schemas['CreateArtistDto'];
export type UpdateArtist = Schemas['UpdateArtistDto'];
export type CreateAlbum = Schemas['CreateAlbumDto'];
export type UpdateAlbum = Schemas['UpdateAlbumDto'];
export type CreateTrack = Schemas['CreateTrackDto'];
export type UpdateTrack = Schemas['UpdateTrackDto'];

type QueryOf<K extends keyof operations> = NonNullable<operations[K]['parameters']['query']>;
export type UserListParams = QueryOf<'AdminUsersController_list'>;
export type SubscriptionListParams = QueryOf<'AdminSubscriptionsController_list'>;
export type ArtistListParams = QueryOf<'AdminArtistsController_list'>;
export type AlbumListParams = QueryOf<'AdminAlbumsController_list'>;
export type TrackListParams = QueryOf<'AdminTracksController_list'>;

/** Rows per page in the admin tables. */
export const ADMIN_PAGE_SIZE = 20;

/** Query key factories for the admin panel (every admin key is built here). */
export const adminKeys = {
  all: ['admin'] as const,
  allStats: () => [...adminKeys.all, 'stats'] as const,
  stats: (days: number) => [...adminKeys.allStats(), days] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userList: (params: UserListParams) => [...adminKeys.users(), 'list', params] as const,
  subscriptions: (params: SubscriptionListParams) =>
    [...adminKeys.all, 'subscriptions', params] as const,
  artists: () => [...adminKeys.all, 'artists'] as const,
  artistList: (params: ArtistListParams) => [...adminKeys.artists(), 'list', params] as const,
  albums: () => [...adminKeys.all, 'albums'] as const,
  albumList: (params: AlbumListParams) => [...adminKeys.albums(), 'list', params] as const,
  album: (id: string) => [...adminKeys.albums(), 'detail', id] as const,
  tracks: () => [...adminKeys.all, 'tracks'] as const,
  trackList: (params: TrackListParams) => [...adminKeys.tracks(), 'list', params] as const,
  track: (id: string) => [...adminKeys.tracks(), 'detail', id] as const,
};

/** Drops empty filters, so `q: ''` and no `q` share a cache entry and a URL. */
export function cleanParams<T extends object>(params: T): T {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as T;
}

/** Unwraps an openapi-fetch result or throws the API error. */
function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data === undefined) {
    throw toApiError(result.error, result.response);
  }
  return result.data;
}

export const adminStatsQuery = (days: number) =>
  queryOptions({
    queryKey: adminKeys.stats(days),
    queryFn: async () => unwrap(await api.GET('/admin/stats', { params: { query: { days } } })),
  });

export const adminUsersQuery = (params: UserListParams) => {
  const query = cleanParams(params);
  return queryOptions({
    queryKey: adminKeys.userList(query),
    queryFn: async () => unwrap(await api.GET('/admin/users', { params: { query } })),
  });
};

export const adminSubscriptionsQuery = (params: SubscriptionListParams) => {
  const query = cleanParams(params);
  return queryOptions({
    queryKey: adminKeys.subscriptions(query),
    queryFn: async () => unwrap(await api.GET('/admin/subscriptions', { params: { query } })),
  });
};

export const adminArtistsQuery = (params: ArtistListParams) => {
  const query = cleanParams(params);
  return queryOptions({
    queryKey: adminKeys.artistList(query),
    queryFn: async () => unwrap(await api.GET('/admin/artists', { params: { query } })),
  });
};

export const adminAlbumsQuery = (params: AlbumListParams) => {
  const query = cleanParams(params);
  return queryOptions({
    queryKey: adminKeys.albumList(query),
    queryFn: async () => unwrap(await api.GET('/admin/albums', { params: { query } })),
  });
};

export const adminAlbumQuery = (id: string) =>
  queryOptions({
    queryKey: adminKeys.album(id),
    queryFn: async () => unwrap(await api.GET('/admin/albums/{id}', { params: { path: { id } } })),
  });

export const adminTracksQuery = (params: TrackListParams) => {
  const query = cleanParams(params);
  return queryOptions({
    queryKey: adminKeys.trackList(query),
    queryFn: async () => unwrap(await api.GET('/admin/tracks', { params: { query } })),
  });
};

export const adminTrackQuery = (id: string) =>
  queryOptions({
    queryKey: adminKeys.track(id),
    queryFn: async () => unwrap(await api.GET('/admin/tracks/{id}', { params: { path: { id } } })),
  });

// ---------- Uploads ----------

export type UploadKind = 'image' | 'audio';

interface UploadRule {
  maxBytes: number;
  extensions: readonly string[];
  /** For the file picker; the API still checks the magic bytes. */
  accept: string;
  /** For example, "JPG, PNG or WebP". */
  types: string;
}

/** Business rule 10, mirrored on the client to fail fast before uploading. */
export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  image: {
    maxBytes: 5 * 1024 * 1024,
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    types: 'JPG, PNG or WebP',
  },
  audio: {
    maxBytes: 100 * 1024 * 1024,
    extensions: ['.mp3', '.flac', '.wav', '.ogg'],
    accept: 'audio/mpeg,audio/flac,audio/wav,audio/ogg,.mp3,.flac,.wav,.ogg',
    types: 'MP3, FLAC, WAV or OGG',
  },
};

export const megabytes = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** Hint shown under a file field, for example "JPG, PNG or WebP up to 5 MB". */
export const uploadHint = (kind: UploadKind) =>
  `${UPLOAD_RULES[kind].types} up to ${megabytes(UPLOAD_RULES[kind].maxBytes)} MB`;

/** `null` when the file may be uploaded, otherwise the reason it may not. */
export function validateUpload(file: { name: string; size: number }, kind: UploadKind) {
  const rule = UPLOAD_RULES[kind];
  const name = file.name.toLowerCase();
  if (!rule.extensions.some((extension) => name.endsWith(extension))) {
    return `Choose a ${rule.types} file.`;
  }
  if (file.size > rule.maxBytes) {
    return `The file is larger than ${megabytes(rule.maxBytes)} MB.`;
  }
  if (file.size === 0) {
    return 'The file is empty.';
  }
  return null;
}

/** Readable message for an upload error code from the API. */
export function uploadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'The upload failed. Try again.';
  }
  switch (error.statusCode) {
    case 413:
      return 'The file is too large.';
    case 415:
      return 'That file type is not supported.';
    case 409:
      return 'This track is still processing. Wait for it to finish.';
    case 0:
      return 'The connection was lost during the upload.';
    default:
      return error.message || 'The upload failed. Try again.';
  }
}

export interface UploadOptions {
  /** Called with the uploaded fraction, from 0 to 1. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

interface RawResponse {
  status: number;
  body: unknown;
}

function send(path: string, file: File, token: string | null, options: UploadOptions) {
  return new Promise<RawResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Network error'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true });

    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

/**
 * Multipart upload with progress. `fetch` cannot report upload progress, so this
 * uses XMLHttpRequest, with the same token handling as the API client: a 401
 * refreshes once and retries.
 */
async function upload<T>(path: string, file: File, options: UploadOptions = {}): Promise<T> {
  let result = await send(path, file, useAuthStore.getState().accessToken, options);
  if (result.status === 401) {
    const token = await refreshAccessToken();
    if (token) {
      options.onProgress?.(0);
      result = await send(path, file, token, options);
    }
  }
  if (result.status >= 200 && result.status < 300) {
    options.onProgress?.(1);
    return result.body as T;
  }
  const body = (result.body ?? {}) as { statusCode?: number; code?: string; message?: string };
  throw new ApiError(
    body.statusCode ?? result.status,
    body.code ?? 'HTTP_ERROR',
    body.message ?? 'Upload failed',
  );
}

export const uploadArtistImage = (id: string, file: File, options?: UploadOptions) =>
  upload<AdminArtist>(`/admin/artists/${id}/image`, file, options);

export const uploadAlbumCover = (id: string, file: File, options?: UploadOptions) =>
  upload<AdminAlbum>(`/admin/albums/${id}/cover`, file, options);

export const uploadTrackAudio = (id: string, file: File, options?: UploadOptions) =>
  upload<AdminTrack>(`/admin/tracks/${id}/audio`, file, options);

/** A processing track changes status on the server, so its views keep polling it. */
export const isTranscoding = (status: TrackStatus) => status === 'processing';

/** Pagination summary for a table footer. */
export function pageInfo(total: number, offset: number, limit: number) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pages, Math.floor(offset / limit) + 1);
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(total, offset + limit);
  return { page, pages, from, to, hasPrev: offset > 0, hasNext: offset + limit < total };
}
