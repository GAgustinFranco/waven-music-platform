import { queryOptions } from '@tanstack/react-query';
import { api } from './client';
import type { components } from './schema';
import { ApiError, toApiError } from './queries';

type Schemas = components['schemas'];
export type ImageSet = Schemas['ImageSetDto'];
export type AlbumSummary = Schemas['AlbumSummaryDto'];
export type ArtistSummary = Schemas['ArtistSummaryDto'];
export type Track = Schemas['TrackDto'];
export type Home = Schemas['HomeDto'];
export type ArtistDetail = Schemas['ArtistDetailDto'];
export type AlbumDetail = Schemas['AlbumDetailDto'];

/** Query key factories for the catalog (every catalog key is built here). */
export const catalogKeys = {
  all: ['catalog'] as const,
  home: () => [...catalogKeys.all, 'home'] as const,
  artists: () => [...catalogKeys.all, 'artists'] as const,
  artist: (id: string) => [...catalogKeys.artists(), id] as const,
  albums: () => [...catalogKeys.all, 'albums'] as const,
  album: (id: string) => [...catalogKeys.albums(), id] as const,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are user input: anything that is not a UUID can never exist. */
export const isUuid = (value: string) => UUID.test(value);

/** 400 (malformed id) and 404 both mean "there is nothing here" for a detail page. */
export const isNotFound = (error: unknown) =>
  error instanceof ApiError && (error.statusCode === 404 || error.statusCode === 400);

export const homeQuery = () =>
  queryOptions({
    queryKey: catalogKeys.home(),
    queryFn: async (): Promise<Home> => {
      const { data, error, response } = await api.GET('/browse/home');
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
  });

export const artistQuery = (id: string) =>
  queryOptions({
    queryKey: catalogKeys.artist(id),
    queryFn: async (): Promise<ArtistDetail> => {
      const { data, error, response } = await api.GET('/artists/{id}', {
        params: { path: { id } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
  });

export const albumQuery = (id: string) =>
  queryOptions({
    queryKey: catalogKeys.album(id),
    queryFn: async (): Promise<AlbumDetail> => {
      const { data, error, response } = await api.GET('/albums/{id}', {
        params: { path: { id } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
  });
