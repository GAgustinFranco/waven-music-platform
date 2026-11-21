'use client';

import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { favoritesContainsQuery, PAGE_SIZE } from '@/lib/api/library';

/**
 * Which of these tracks are liked, asked in chunks of 50 (the API's cap).
 * Returns `undefined` until the answers arrive, so hearts do not flash.
 */
export function useLikedSet(trackIds: readonly string[]): Set<string> | undefined {
  const ready = useSessionReady();
  const chunks = useMemo(() => {
    const unique = [...new Set(trackIds)].sort();
    const result: string[][] = [];
    for (let i = 0; i < unique.length; i += PAGE_SIZE) {
      result.push(unique.slice(i, i + PAGE_SIZE));
    }
    return result;
  }, [trackIds]);

  return useQueries({
    queries: chunks.map((ids) => ({ ...favoritesContainsQuery(ids), enabled: ready })),
    combine: (results) =>
      results.every((result) => result.data !== undefined)
        ? new Set(results.flatMap((result) => result.data ?? []))
        : undefined,
  });
}
