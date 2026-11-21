'use client';

import Link from 'next/link';
import { CoverImage } from '@/components/catalog/cover-image';
import { PlayCollectionButton } from '@/components/player/play-collection-button';
import type { ImageSet, Track } from '@/lib/api/catalog';
import type { SearchResults, TopResult } from '@/lib/api/search';
import { SEARCH_SOURCE } from './source';

interface CardContent {
  href: string;
  title: string;
  kind: string;
  subtitle: string | null;
  image: ImageSet | null;
  round: boolean;
}

function describe(top: TopResult, results: SearchResults): CardContent | null {
  switch (top.type) {
    case 'track': {
      const track = results.tracks.find((item) => item.id === top.id);
      return track
        ? {
            href: `/albums/${track.album.id}`,
            title: track.title,
            kind: 'Song',
            subtitle: track.artist.name,
            image: track.album.cover,
            round: false,
          }
        : null;
    }
    case 'album': {
      const album = results.albums.find((item) => item.id === top.id);
      return album
        ? {
            href: `/albums/${album.id}`,
            title: album.title,
            kind: 'Album',
            subtitle: album.artist.name,
            image: album.cover,
            round: false,
          }
        : null;
    }
    case 'artist': {
      const artist = results.artists.find((item) => item.id === top.id);
      return artist
        ? {
            href: `/artists/${artist.id}`,
            title: artist.name,
            kind: 'Artist',
            subtitle: null,
            image: artist.image,
            round: true,
          }
        : null;
    }
  }
}

/**
 * The best hit across types. The title link stretches over the whole card; a
 * top song also gets a play button that queues the other songs after it.
 */
export function TopResultCard({
  top,
  results,
  queue,
}: {
  top: TopResult;
  results: SearchResults;
  queue: Track[];
}) {
  const content = describe(top, results);
  if (!content) {
    return null;
  }

  return (
    <div className="group bg-surface hover:bg-surface-2 ease-standard relative flex flex-col gap-5 rounded-md p-5 transition-colors duration-150">
      <CoverImage
        image={content.image}
        sizes="96px"
        shape={content.round ? 'round' : 'square'}
        className="w-24 shadow-lg"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          href={content.href}
          className="truncate text-3xl font-bold tracking-tight after:absolute after:inset-0 after:rounded-md"
        >
          {content.title}
        </Link>
        <p className="text-muted-foreground truncate text-sm">
          <span className="text-foreground font-medium">{content.kind}</span>
          {content.subtitle ? ` · ${content.subtitle}` : null}
        </p>
      </div>
      {top.type === 'track' && queue.length > 0 ? (
        <div className="absolute right-5 bottom-5 z-10">
          <PlayCollectionButton tracks={queue} source={SEARCH_SOURCE} label={content.title} />
        </div>
      ) : null}
    </div>
  );
}
