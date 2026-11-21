'use client';

import { ListMusic, Music } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { selectCurrentTrack, usePlayerStore } from '@/stores/player.store';
import { TransportControls, VolumeControl } from './controls';
import { NowPlaying } from './now-playing';
import { SeekBar } from './seek-bar';

/** Fixed 88 px player bar from 768 px up (ARCHITECTURE §7). */
export function PlayerBar() {
  const track = usePlayerStore(selectCurrentTrack);

  return (
    <section
      aria-label="Player"
      className="h-player bg-surface border-border px-gutter-lg hidden items-center gap-4 border-t md:col-span-full md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]"
    >
      {track ? (
        <>
          <NowPlaying track={track} />
          <div className="flex flex-col items-center gap-1">
            <TransportControls />
            <SeekBar className="max-w-xl" />
          </div>
          <div className="flex items-center justify-end gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon-lg"
              className="text-muted-foreground hover:text-foreground rounded-full"
            >
              <Link href="/queue" aria-label="Queue">
                <ListMusic aria-hidden="true" className="size-5" />
              </Link>
            </Button>
            <div className="hidden lg:block">
              <VolumeControl />
            </div>
          </div>
        </>
      ) : (
        <div className="col-span-full flex items-center gap-3">
          <Music aria-hidden="true" className="text-muted-foreground size-5" />
          <p className="text-muted-foreground text-sm">Nothing playing yet.</p>
        </div>
      )}
    </section>
  );
}
