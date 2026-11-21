import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from './client';
import { toApiError } from './queries';
import type { components } from './schema';

type Schemas = components['schemas'];
export type SearchResults = Schemas['SearchResultsDto'];
export type SearchType = Schemas['SearchType'];
export type TopResult = Schemas['TopResultDto'];

export const SEARCH_TYPES: readonly SearchType[] = ['all', 'track', 'album', 'artist'];
/** The API's cap on `q`. */
export const MAX_QUERY_LENGTH = 100;

export const isSearchType = (value: string | null): value is SearchType =>
  value !== null && (SEARCH_TYPES as readonly string[]).includes(value);

/** What the API compares: surrounding spaces never change the results. */
export const normalizeQuery = (q: string) => q.trim().slice(0, MAX_QUERY_LENGTH);

/** Query key factories for search (every search key is built here). */
export const searchKeys = {
  all: ['search'] as const,
  results: (q: string, type: SearchType) =>
    [...searchKeys.all, normalizeQuery(q).toLowerCase(), type] as const,
};

export const searchQuery = (q: string, type: SearchType) =>
  queryOptions({
    queryKey: searchKeys.results(q, type),
    queryFn: async ({ signal }): Promise<SearchResults> => {
      const { data, error, response } = await api.GET('/search', {
        params: { query: { q: normalizeQuery(q), type, limit: type === 'all' ? 6 : 20 } },
        signal,
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    // Keeps the last results on screen while the next keystroke loads.
    placeholderData: keepPreviousData,
  });

/** The URL of a search; `all` is the default, so it is left out. */
export function searchHref(q: string, type: SearchType): string {
  const params = new URLSearchParams();
  const query = normalizeQuery(q);
  if (query !== '') {
    params.set('q', query);
  }
  if (type !== 'all') {
    params.set('type', type);
  }
  const search = params.toString();
  return search ? `/search?${search}` : '/search';
}
