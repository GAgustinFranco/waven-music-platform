'use client';

import { useQuery } from '@tanstack/react-query';
import { Disc3, ListMusic } from 'lucide-react';
import { useParams } from 'next/navigation';
import { DominantHeader, DominantHeaderSkeleton } from '@/components/catalog/dominant-header';
import { MediaCard, MediaGrid, MediaGridSkeleton } from '@/components/catalog/media-card';
import { Section } from '@/components/catalog/section';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { TrackList, TrackListSkeleton, TrackRow } from '@/components/catalog/track-row';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { artistQuery, isNotFound, isUuid } from '@/lib/api/catalog';
import { pluralize, releaseYear } from '@/lib/format';
import { NotFoundState } from './not-found-state';

export function ArtistView() {
  const { id } = useParams<{ id: string }>();
  const validId = isUuid(id);
  const ready = useSessionReady();
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    ...artistQuery(id),
    enabled: ready && validId,
  });

  if (!validId || isNotFound(error)) {
    return <NotFoundState kind="artist" />;
  }

  if (isPending) {
    return (
      <>
        <LoadingStatus label="Loading artist" />
        <DominantHeaderSkeleton shape="round" />
        <div className="px-gutter lg:px-gutter-lg flex flex-col gap-10 pt-6">
          <TrackListSkeleton />
          <MediaGridSkeleton />
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

  // Artists have no color of their own: borrow the latest album's.
  const headerColor = data.albums.find((album) => album.dominantColor)?.dominantColor ?? null;

  return (
    <>
      <title>{`${data.name} · Waven`}</title>
      <DominantHeader
        kind="Artist"
        title={data.name}
        image={data.image}
        imageShape="round"
        dominantColor={headerColor}
      >
        <p>{pluralize(data.albums.length, 'album')}</p>
      </DominantHeader>

      <div className="px-gutter lg:px-gutter-lg flex flex-col gap-10 pt-6">
        <Section id="popular" title="Popular">
          {data.popularTracks.length > 0 ? (
            <TrackList label={`Popular tracks by ${data.name}`}>
              {data.popularTracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  position={index + 1}
                  showCover
                  showAlbum
                  showArtist={false}
                />
              ))}
            </TrackList>
          ) : (
            <EmptyState icon={ListMusic} as="h3" title="No tracks yet" />
          )}
        </Section>

        <Section id="albums" title="Albums">
          {data.albums.length > 0 ? (
            <MediaGrid label={`Albums by ${data.name}`}>
              {data.albums.map((album) => (
                <li key={album.id}>
                  <MediaCard
                    href={`/albums/${album.id}`}
                    title={album.title}
                    subtitle={releaseYear(album.releaseDate) ?? 'Album'}
                    image={album.cover}
                  />
                </li>
              ))}
            </MediaGrid>
          ) : (
            <EmptyState icon={Disc3} as="h3" title="No albums yet" />
          )}
        </Section>

        {data.bio ? (
          <Section id="about" title="About">
            <p className="text-muted-foreground max-w-prose text-base whitespace-pre-line">
              {data.bio}
            </p>
          </Section>
        ) : null}
      </div>
    </>
  );
}
