'use client';

import { cn } from 'cn';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Track } from '@/lib/api/catalog';
import { type PlaySource, usePlayerStore } from '@/stores/player.store';

const isSameSource = (a: PlaySource | null, b: PlaySource) =>
  a !== null && a.context === b.context && a.id === b.id;

/**
 * The play button of album, artist and playlist headers. Plays the collection
 * from the start, or pauses/resumes it when it is the one already playing.
 */
export function PlayCollectionButton({
  tracks,
  source,
  label,
  size = 'lg',
}: {
  tracks: Track[];
  source: PlaySource;
  /** e.g. the album title: "Play {label}". */
  label: string;
  /** `sm` fits the compact bar of a scrolled page header. */
  size?: 'lg' | 'sm';
}) {
  const active = usePlayerStore((state) => isSameSource(state.source, source));
  const isPlaying = usePlayerStore((state) => state.isPlaying && active);
  const playQueue = usePlayerStore((state) => state.playQueue);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const Icon = isPlaying ? Pause : Play;

  return (
    <Button
      type="button"
      disabled={tracks.length === 0}
      aria-label={`${isPlaying ? 'Pause' : 'Play'} ${label}`}
      onClick={() => (active ? togglePlay() : playQueue(tracks, 0, source))}
      className={cn(
        'bg-brand text-primary-foreground hover:bg-brand-hover hover:shadow-brand/30 shrink-0 rounded-full shadow-lg hover:scale-105',
        size === 'lg' ? 'size-14' : 'size-10',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('fill-current', size === 'lg' ? 'size-6' : 'size-4')}
      />
    </Button>
  );
}
