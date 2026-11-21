'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { PrefetchLink } from '@/components/catalog/prefetch-link';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { LikedSongsCover, PlaylistCover } from '@/components/library/playlist-cover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { myPlaylistsQuery } from '@/lib/api/library';
import { pluralize } from '@/lib/format';
import { useHydrated } from '@/lib/use-hydrated';
import { useLibrary } from './library-provider';

/** "Your library" in the sidebar: Liked Songs, then the user's playlists. */
export function SidebarLibrary({ pathname }: { pathname: string | null }) {
  // The sidebar hydrates after the session (and maybe these playlists) is already
  // in memory, so it first renders what the server sent: no playlists yet.
  const hydrated = useHydrated();
  const ready = useSessionReady() && hydrated;
  const query = useQuery({ ...myPlaylistsQuery(), enabled: ready });
  const data = hydrated ? query.data : undefined;
  const isPending = query.isPending;
  const isError = hydrated && query.isError;
  const { createPlaylist, creating } = useLibrary();

  return (
    <section aria-labelledby="sidebar-library" className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-3 max-lg:justify-center max-lg:px-0">
        <h2
          id="sidebar-library"
          className="text-muted-foreground text-sm font-semibold max-lg:sr-only"
        >
          Your library
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Create playlist"
          title="Create playlist"
          disabled={creating}
          onClick={() => createPlaylist()}
          className="text-muted-foreground hover:text-foreground"
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>

      <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        <SidebarItem
          href="/favorites"
          active={pathname === '/favorites'}
          title="Liked Songs"
          subtitle="Playlist"
          cover={<LikedSongsCover className="size-10 shrink-0" />}
        />
        {isPending && ready
          ? Array.from({ length: 3 }, (_, index) => (
              <li key={index} aria-hidden="true" className="flex items-center gap-3 px-2 py-1.5">
                <Skeleton className="size-10 shrink-0" />
                <Skeleton className="h-4 w-2/3 max-lg:hidden" />
              </li>
            ))
          : null}
        {isError ? (
          <li className="text-muted-foreground px-3 py-2 text-sm max-lg:sr-only">
            Couldn&apos;t load your playlists.
          </li>
        ) : null}
        {data?.items.map((playlist) => (
          <SidebarItem
            key={playlist.id}
            href={`/playlists/${playlist.id}`}
            active={pathname === `/playlists/${playlist.id}`}
            title={playlist.name}
            subtitle={`Playlist · ${pluralize(playlist.trackCount, 'track')}`}
            cover={
              <PlaylistCover covers={playlist.covers} sizes="40px" className="size-10 shrink-0" />
            }
          />
        ))}
      </ul>
    </section>
  );
}

function SidebarItem({
  href,
  active,
  title,
  subtitle,
  cover,
}: {
  href: string;
  active: boolean;
  title: string;
  subtitle: string;
  cover: ReactNode;
}) {
  return (
    <li>
      <PrefetchLink
        href={href}
        title={title}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'ease-standard flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 max-lg:justify-center',
          active ? 'bg-surface-2' : 'hover:bg-surface-2',
        )}
      >
        {cover}
        <span className="min-w-0 max-lg:sr-only">
          <span className={cn('block truncate text-sm font-medium', active && 'text-brand')}>
            {title}
          </span>
          <span className="text-muted-foreground block truncate text-xs">{subtitle}</span>
        </span>
      </PrefetchLink>
    </li>
  );
}
