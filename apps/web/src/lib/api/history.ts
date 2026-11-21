import { infiniteQueryOptions } from '@tanstack/react-query';
import { api } from './client';
import { toApiError } from './queries';
import type { components } from './schema';

type Schemas = components['schemas'];
export type HistoryEntry = Schemas['HistoryEntryDto'];
export type HistoryPage = Schemas['HistoryPageDto'];

const PAGE_SIZE = 50;

/** Query key factories for the listening history (every history key is built here). */
export const historyKeys = {
  all: ['history'] as const,
  list: () => [...historyKeys.all, 'list'] as const,
};

/** Newest play first; pages follow the API's cursor, so none repeats an entry. */
export const historyQuery = () =>
  infiniteQueryOptions({
    queryKey: historyKeys.list(),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<HistoryPage> => {
      const { data, error, response } = await api.GET('/me/history', {
        params: { query: { limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
