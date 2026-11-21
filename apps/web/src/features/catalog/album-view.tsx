'use client';

import { useQuery } from '@tanstack/react-query';
import { ListMusic } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DominantHeader, DominantHeaderSkeleton } from '@/components/catalog/dominant-header';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { TrackList, TrackListSkeleton, TrackRow } from '@/components/catalog/track-row';
import { PlayCollectionButton } from '@/components/player/play-collection-button';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { useLikedSet } from '@/features/library/use-liked';
import { albumQuery, isNotFound, isUuid } from '@/lib/api/catalog';
import { formatTotalDuration, pluralize, releaseYear } from '@/lib/format';
import { type PlaySource, usePlayerStore } from '@/stores/player.store';
import { NotFoundState } from './not-found-state';

export function AlbumView() {
  const { id } = useParams<{ id: string }>();
  const validId = isUuid(id);
  const ready = useSessionReady();
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    ...albumQuery(id),
    enabled: ready && validId,
  });
  const playQueue = usePlayerStore((state) => state.playQueue);
  const liked = useLikedSet(data?.tracks.map((track) => track.id) ?? []);

  if (!validId || isNotFound(error)) {
    return <NotFoundState kind="album" />;
  }

  if (isPending) {
    return (
      <>
        <LoadingStatus label="Loading album" />
        <DominantHeaderSkeleton />
        <div className="px-gutter lg:px-gutter-lg pt-6">
          <TrackListSkeleton count={8} />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <div className="px-gutter lg:px-gutter-lg pt-20">
        <ErrorState as="h1" onRetry={() => void refetch()} retrying={isRefetching} />
      </div>
    );
  }

  const year = releaseYear(data.releaseDate);
  const source: PlaySource = { context: 'album', id: data.id };

  return (
    <>
      <title>{`${data.title} · ${data.artist.name} · Waven`}</title>
      <DominantHeader
        kind="Album"
        title={data.title}
        image={data.cover}
        dominantColor={data.dominantColor}
      >
        <p className="flex flex-wrap items-center gap-x-1.5">
          <Link
            href={`/artists/${data.artist.id}`}
            className="inline-block rounded-sm py-0.5 font-semibold hover:underline"
          >
            {data.artist.name}
          </Link>
          {year ? <span aria-hidden="true">·</span> : null}
          {year ? <span>{year}</span> : null}
          <span aria-hidden="true">·</span>
          <span>{pluralize(data.tracks.length, 'track')}</span>
          {data.tracks.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatTotalDuration(data.durationMs)}</span>
            </>
          ) : null}
        </p>
      </DominantHeader>

      <div className="px-gutter lg:px-gutter-lg flex flex-col gap-4 pt-6">
        {data.tracks.length > 0 ? (
          <>
            <PlayCollectionButton tracks={data.tracks} source={source} label={data.title} />
            <TrackList label={`${data.title} tracks`}>
              {data.tracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  position={track.trackNumber}
                  showArtist={track.artist.id !== data.artist.id}
                  onPlay={() => playQueue(data.tracks, index, source)}
                  liked={liked?.has(track.id)}
                />
              ))}
            </TrackList>
          </>
        ) : (
          <EmptyState
            icon={ListMusic}
            title="This album has no tracks yet"
            description="Check back soon."
          />
        )}
      </div>
    </>
  );
}
