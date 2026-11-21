'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import {
  COVER_CLASS,
  DominantHeader,
  DominantHeaderSkeleton,
} from '@/components/catalog/dominant-header';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { TrackList, TrackListSkeleton, TrackRow } from '@/components/catalog/track-row';
import { LikedSongsCover } from '@/components/library/playlist-cover';
import { PlayCollectionButton } from '@/components/player/play-collection-button';
import { Button } from '@/components/ui/button';
import { useSessionReady } from '@/features/auth/use-session-ready';
import type { Track } from '@/lib/api/catalog';
import { favoritesQuery } from '@/lib/api/library';
import { pluralize } from '@/lib/format';
import { type PlaySource, usePlayerStore } from '@/stores/player.store';
import { useLikedSet } from './use-liked';

const SOURCE: PlaySource = { context: 'favorites', id: null };

/** Liked Songs (US-12), newest first, 50 at a time. */
export function FavoritesView() {
  const ready = useSessionReady();
  const query = useInfiniteQuery({ ...favoritesQuery(), enabled: ready });
  const playQueue = usePlayerStore((state) => state.playQueue);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const liked = useLikedSet(items.map((item) => item.track.id));
  const { tracks, queueIndex } = useMemo(() => {
    const playable: Track[] = [];
    const indexByTrack = new Map<string, number>();
    for (const item of items) {
      if (item.available) {
        indexByTrack.set(item.track.id, playable.length);
        playable.push(item.track);
      }
    }
    return { tracks: playable, queueIndex: indexByTrack };
  }, [items]);

  if (query.isPending) {
    return (
      <>
        <LoadingStatus label="Loading Liked Songs" />
        <DominantHeaderSkeleton />
        <div className="px-gutter lg:px-gutter-lg pt-6">
          <TrackListSkeleton count={8} />
        </div>
      </>
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
    <>
      <title>Liked Songs · Waven</title>
      <DominantHeader
        kind="Playlist"
        title="Liked Songs"
        image={null}
        dominantColor={null}
        cover={<LikedSongsCover className={COVER_CLASS} />}
      >
        <p>{pluralize(total, 'track')}</p>
      </DominantHeader>

      <div className="px-gutter lg:px-gutter-lg flex flex-col gap-4 pt-6">
        {items.length > 0 ? (
          <>
            {tracks.length > 0 ? (
              <PlayCollectionButton tracks={tracks} source={SOURCE} label="Liked Songs" />
            ) : null}
            <TrackList label="Liked Songs">
              {items.map((item, index) => (
                <TrackRow
                  key={item.track.id}
                  track={item.track}
                  position={index + 1}
                  showCover
                  showAlbum
                  unavailable={!item.available}
                  // Listed means liked; an unliked row stays (hollow heart) until the list refetches.
                  liked={liked ? liked.has(item.track.id) : true}
                  onPlay={() => {
                    const start = queueIndex.get(item.track.id);
                    if (start !== undefined) {
                      playQueue(tracks, start, SOURCE);
                    }
                  }}
                />
              ))}
            </TrackList>
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
            icon={Heart}
            title="Songs you like will appear here"
            description="Save songs by tapping the heart icon."
          >
            <Button asChild variant="secondary">
              <Link href="/">Find songs</Link>
            </Button>
          </EmptyState>
        )}
      </div>
    </>
  );
}
