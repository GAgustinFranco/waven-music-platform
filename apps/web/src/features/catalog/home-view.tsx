'use client';

import { useQuery } from '@tanstack/react-query';
import { Disc3, History, ListMusic } from 'lucide-react';
import { MediaCard, MediaGrid, MediaGridSkeleton } from '@/components/catalog/media-card';
import { Section } from '@/components/catalog/section';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { TrackList, TrackListSkeleton, TrackRow } from '@/components/catalog/track-row';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { homeQuery } from '@/lib/api/catalog';
import { releaseYear } from '@/lib/format';
import { type PlaySource, usePlayerStore } from '@/stores/player.store';

const HOME: PlaySource = { context: 'home', id: null };

export function HomeView() {
  const ready = useSessionReady();
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    ...homeQuery(),
    enabled: ready,
  });
  const playQueue = usePlayerStore((state) => state.playQueue);

  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-10 pt-20">
      <h1 className="text-3xl font-bold tracking-tight">Home</h1>

      {isPending ? (
        <>
          <LoadingStatus label="Loading your home page" />
          <Section id="new-releases" title="New releases">
            <MediaGridSkeleton />
          </Section>
          <Section id="popular" title="Popular tracks">
            <TrackListSkeleton />
          </Section>
        </>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} retrying={isRefetching} />
      ) : (
        <>
          <Section id="new-releases" title="New releases">
            {data.newReleases.length > 0 ? (
              <MediaGrid label="New releases">
                {data.newReleases.map((album) => (
                  <li key={album.id}>
                    <MediaCard
                      href={`/albums/${album.id}`}
                      title={album.title}
                      subtitle={[releaseYear(album.releaseDate), album.artist.name]
                        .filter(Boolean)
                        .join(' · ')}
                      image={album.cover}
                    />
                  </li>
                ))}
              </MediaGrid>
            ) : (
              <EmptyState
                icon={Disc3}
                as="h3"
                title="No releases yet"
                description="New albums will show up here as soon as they are added."
              />
            )}
          </Section>

          <Section id="popular" title="Popular tracks">
            {data.popularTracks.length > 0 ? (
              <TrackList label="Popular tracks">
                {data.popularTracks.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    position={index + 1}
                    showCover
                    showAlbum
                    onPlay={() => playQueue(data.popularTracks, index, HOME)}
                  />
                ))}
              </TrackList>
            ) : (
              <EmptyState
                icon={ListMusic}
                as="h3"
                title="Nothing popular yet"
                description="The most played tracks will appear here."
              />
            )}
          </Section>

          <Section id="recently-played" title="Recently played">
            {data.recentlyPlayed.length > 0 ? (
              <TrackList label="Recently played">
                {data.recentlyPlayed.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    position={index + 1}
                    showCover
                    showAlbum
                    onPlay={() => playQueue(data.recentlyPlayed, index, HOME)}
                  />
                ))}
              </TrackList>
            ) : (
              <EmptyState
                icon={History}
                as="h3"
                title="No listening history yet"
                description="Tracks you play will show up here so you can jump back in."
              />
            )}
          </Section>
        </>
      )}
    </div>
  );
}
