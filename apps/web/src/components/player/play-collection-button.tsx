'use client';

import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Track } from '@/lib/api/catalog';
import { type PlaySource, usePlayerStore } from '@/stores/player.store';

const isSameSource = (a: PlaySource | null, b: PlaySource) =>
  a !== null && a.context === b.context && a.id === b.id;

/**
 * The big play button of album and artist headers. Plays the collection from
 * the start, or pauses/resumes it when it is the one already playing.
 */
export function PlayCollectionButton({
  tracks,
  source,
  label,
}: {
  tracks: Track[];
  source: PlaySource;
  /** e.g. the album title: "Play {label}". */
  label: string;
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
      className="bg-brand text-primary-foreground hover:bg-brand-hover size-14 rounded-full shadow-lg"
    >
      <Icon aria-hidden="true" className="size-6 fill-current" />
    </Button>
  );
}
