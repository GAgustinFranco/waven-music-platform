'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Section } from '@/components/catalog/section';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { TrackList, TrackListSkeleton, TrackRow } from '@/components/catalog/track-row';
import { PlayCollectionButton } from '@/components/player/play-collection-button';
import { Button } from '@/components/ui/button';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { useLikedSet } from '@/features/library/use-liked';
import type { Track } from '@/lib/api/catalog';
import { historyQuery } from '@/lib/api/history';
import { type PlaySource, usePlayerStore } from '@/stores/player.store';
import { groupByDay } from './group-by-day';

const SOURCE: PlaySource = { context: 'other', id: null };

/** Every play, newest first, grouped by day (US-13). One row per play. */
export function HistoryView() {
  const ready = useSessionReady();
  const query = useInfiniteQuery({ ...historyQuery(), enabled: ready });
  const playQueue = usePlayerStore((state) => state.playQueue);
  const entries = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const groups = useMemo(() => groupByDay(entries), [entries]);
  const liked = useLikedSet(entries.map((entry) => entry.track.id));
  // The queue replays the history as listed, skipping unavailable tracks.
  const { tracks, queueIndex } = useMemo(() => {
    const playable: Track[] = [];
    const indexByEntry = new Map<string, number>();
    for (const entry of entries) {
      if (entry.available) {
        indexByEntry.set(entry.id, playable.length);
        playable.push(entry.track);
      }
    }
    return { tracks: playable, queueIndex: indexByEntry };
  }, [entries]);

  const header = (
    <div className="flex flex-wrap items-center gap-4">
      {tracks.length > 0 ? (
        <PlayCollectionButton tracks={tracks} source={SOURCE} label="your listening history" />
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight">Listening history</h1>
    </div>
  );

  if (query.isPending) {
    return (
      <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20">
        <LoadingStatus label="Loading your listening history" />
        {header}
        <TrackListSkeleton count={8} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="px-gutter lg:px-gutter-lg pt-20">
        <ErrorState as="h1" onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      </div>
    );
  }

  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20">
      {header}
      {groups.length > 0 ? (
        <>
          {groups.map((group) => (
            <Section key={group.key} id={`history-${group.key}`} title={group.label}>
              <TrackList label={group.label}>
                {group.entries.map((entry, index) => (
                  <TrackRow
                    key={entry.id}
                    track={entry.track}
                    position={group.start + index + 1}
                    showCover
                    showAlbum
                    unavailable={!entry.available}
                    liked={liked?.has(entry.track.id)}
                    onPlay={() => {
                      const start = queueIndex.get(entry.id);
                      if (start !== undefined) {
                        playQueue(tracks, start, SOURCE);
                      }
                    }}
                  />
                ))}
              </TrackList>
            </Section>
          ))}
          {query.hasNextPage ? (
            <Button
              variant="secondary"
              className="self-center"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Show more'}
            </Button>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={History}
          title="Nothing played yet"
          description="Every track you listen to for 30 seconds or more shows up here."
        >
          <Button asChild variant="secondary">
            <Link href="/search">Find something to play</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
