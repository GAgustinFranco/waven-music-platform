'use client';

import { AudioLines, ExternalLink, Info, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import type { Track } from '@/lib/api/catalog';
import { describeDuration, formatDuration } from '@/lib/format';
import { selectCurrentTrack, usePlayerStore } from '@/stores/player.store';
import { CoverImage } from './cover-image';

interface TrackRowProps {
  track: Track;
  /** Shown in the first column: the album track number or the list position. */
  position: number;
  /** Small cover next to the title (lists that mix albums). */
  showCover?: boolean;
  /** Album column, from 1024 px up. */
  showAlbum?: boolean;
  /** Hidden on album pages, where every track shares the artist in the header. */
  showArtist?: boolean;
  /** Plays this list from this track; without it the row has no play button. */
  onPlay?: () => void;
}

const GRID = 'grid grid-cols-[--spacing(8)_minmax(0,1fr)_auto_auto] items-center gap-3 lg:gap-4';
const GRID_WITH_ALBUM = 'lg:grid-cols-[--spacing(8)_minmax(0,4fr)_minmax(0,3fr)_auto_auto]';

export function TrackRow({
  track,
  position,
  showCover = false,
  showAlbum = false,
  showArtist = true,
  onPlay,
}: TrackRowProps) {
  const isCurrent = usePlayerStore((state) => selectCurrentTrack(state)?.id === track.id);
  const isPlaying = usePlayerStore((state) => state.isPlaying) && isCurrent;

  return (
    <li
      aria-current={isCurrent ? 'true' : undefined}
      className={`group/row ${GRID} ${showAlbum ? GRID_WITH_ALBUM : ''} hover:bg-surface-2 ease-standard relative rounded-sm px-2 py-2 transition-colors duration-150 sm:px-4`}
    >
      <div className="relative flex h-8 items-center justify-end">
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            isCurrent ? 'text-brand' : 'text-muted-foreground',
            onPlay &&
              'group-hover/row:invisible group-has-[[data-play]:focus-visible]/row:invisible [@media(hover:none)]:invisible',
          )}
        >
          {isPlaying ? <AudioLines role="img" aria-label="Playing" className="size-4" /> : position}
        </span>
        {onPlay ? (
          <TrackPlayButton
            title={track.title}
            isCurrent={isCurrent}
            isPlaying={isPlaying}
            onPlay={onPlay}
          />
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        {showCover ? (
          <CoverImage image={track.album.cover} sizes="40px" className="size-10 shrink-0" />
        ) : null}
        <div className="min-w-0">
          <p className={cn('truncate text-base font-medium', isCurrent && 'text-brand')}>
            {track.title}
          </p>
          {showArtist ? (
            <Link
              href={`/artists/${track.artist.id}`}
              className="text-muted-foreground hover:text-foreground block truncate rounded-sm py-0.5 text-sm hover:underline"
            >
              {track.artist.name}
            </Link>
          ) : null}
        </div>
      </div>

      {showAlbum ? (
        <Link
          href={`/albums/${track.album.id}`}
          className="text-muted-foreground hover:text-foreground hidden truncate rounded-sm py-0.5 text-sm hover:underline lg:block"
        >
          {track.album.title}
        </Link>
      ) : null}

      <TrackDetails track={track} />

      <span className="text-muted-foreground min-w-[5ch] text-right font-mono text-sm tabular-nums">
        <span aria-hidden="true">{formatDuration(track.durationMs)}</span>
        <span className="sr-only">{describeDuration(track.durationMs)}</span>
      </span>
    </li>
  );
}

function TrackPlayButton({
  title,
  isCurrent,
  isPlaying,
  onPlay,
}: {
  title: string;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const Icon = isPlaying ? Pause : Play;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-play=""
      aria-label={`${isPlaying ? 'Pause' : 'Play'} ${title}`}
      onClick={isCurrent ? togglePlay : onPlay}
      className="absolute inset-y-0 right-0 my-auto opacity-0 group-hover/row:opacity-100 hover:bg-transparent focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <Icon aria-hidden="true" className="size-4 fill-current" />
    </Button>
  );
}

/** License and attribution, which Creative Commons tracks must show (SPEC §7). */
function TrackDetails({ track }: { track: Track }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          aria-label={`Details for ${track.title}`}
        >
          <Info aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex flex-col gap-3">
        <p className="font-medium">{track.title}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">Artist</dt>
          <dd>{track.artist.name}</dd>
          <dt className="text-muted-foreground">Album</dt>
          <dd>{track.album.title}</dd>
          <dt className="text-muted-foreground">License</dt>
          <dd>{track.license ?? 'Not specified'}</dd>
        </dl>
        {track.attributionUrl ? (
          <a
            href={track.attributionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:text-brand-hover inline-flex items-center gap-1 self-start rounded-sm underline-offset-4 hover:underline"
          >
            View attribution
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function TrackList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col">
      {children}
    </ol>
  );
}

export function TrackListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`${GRID} px-2 py-2 sm:px-4`}>
          <Skeleton className="h-4 w-4 justify-self-end" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <span />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}
