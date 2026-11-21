'use client';

import { useQuery } from '@tanstack/react-query';
import { History, Plus } from 'lucide-react';
import {
  MEDIA_CARD_SIZES,
  MediaCard,
  MediaGrid,
  MediaGridSkeleton,
} from '@/components/catalog/media-card';
import { ErrorState, LoadingStatus } from '@/components/catalog/states';
import { LikedSongsCover, PlaylistCover } from '@/components/library/playlist-cover';
import { Button } from '@/components/ui/button';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { myPlaylistsQuery } from '@/lib/api/library';
import { pluralize } from '@/lib/format';
import { useLibrary } from './library-provider';

export function LibraryView() {
  const ready = useSessionReady();
  const { data, isPending, isError, refetch, isRefetching } = useQuery({
    ...myPlaylistsQuery(),
    enabled: ready,
  });
  const { createPlaylist, creating } = useLibrary();

  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Your library</h1>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={creating}
          onClick={() => createPlaylist()}
        >
          <Plus aria-hidden="true" />
          Create playlist
        </Button>
      </div>

      {isPending ? (
        <>
          <LoadingStatus label="Loading your library" />
          <MediaGridSkeleton />
        </>
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} retrying={isRefetching} />
      ) : (
        <MediaGrid label="Playlists">
          <li>
            <MediaCard
              href="/favorites"
              title="Liked Songs"
              subtitle="Your favorite tracks"
              image={null}
              cover={<LikedSongsCover className="w-full shadow-md" />}
            />
          </li>
          <li>
            <MediaCard
              href="/history"
              title="Listening history"
              subtitle="Everything you played"
              image={null}
              cover={
                <div className="bg-surface-2 text-muted-foreground flex aspect-square w-full items-center justify-center rounded-md shadow-md">
                  <History aria-hidden="true" className="size-1/3" />
                </div>
              }
            />
          </li>
          {data.items.map((playlist) => (
            <li key={playlist.id}>
              <MediaCard
                href={`/playlists/${playlist.id}`}
                title={playlist.name}
                subtitle={`Playlist · ${pluralize(playlist.trackCount, 'track')}`}
                image={null}
                cover={
                  <PlaylistCover
                    covers={playlist.covers}
                    sizes={MEDIA_CARD_SIZES}
                    className="w-full shadow-md"
                  />
                }
              />
            </li>
          ))}
        </MediaGrid>
      )}
    </div>
  );
}
