'use client';

import Link from 'next/link';
import { CoverImage } from '@/components/catalog/cover-image';
import type { Track } from '@/lib/api/catalog';
import { usePlayerStore } from '@/stores/player.store';

/** Cover, title and artist of the current track. Links are optional (the mini player is one big button). */
export function NowPlaying({ track, links = true }: { track: Track; links?: boolean }) {
  const error = usePlayerStore((state) => state.error);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <CoverImage image={track.album.cover} sizes="56px" className="size-12 shrink-0 lg:size-14" />
      <div className="min-w-0">
        {links ? (
          <Link
            href={`/albums/${track.album.id}`}
            className="block truncate rounded-sm text-sm font-medium hover:underline"
          >
            {track.title}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium">{track.title}</p>
        )}
        {error ? (
          <p className="text-danger truncate text-xs">{error}</p>
        ) : links ? (
          <Link
            href={`/artists/${track.artist.id}`}
            className="text-muted-foreground hover:text-foreground block truncate rounded-sm text-xs hover:underline"
          >
            {track.artist.name}
          </Link>
        ) : (
          <p className="text-muted-foreground truncate text-xs">{track.artist.name}</p>
        )}
      </div>
    </div>
  );
}
