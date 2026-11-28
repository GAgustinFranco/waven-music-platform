'use client';

import { ListMusic, Maximize2, Music } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NowPlayingTrigger, NowPlayingView } from '@/features/player/now-playing/now-playing-view';
import { selectCurrentTrack, usePlayerStore } from '@/stores/player.store';
import { TransportControls, VolumeControl } from './controls';
import { NowPlaying } from './now-playing';
import { SeekBar } from './seek-bar';

const COVER_LAYOUT_ID = 'now-playing-cover-bar';

/** Fixed 88 px player bar from 768 px up (ARCHITECTURE §7). */
export function PlayerBar() {
  const track = usePlayerStore(selectCurrentTrack);
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-label="Player"
      className="h-player bg-surface border-border px-gutter-lg hidden items-center gap-4 border-t md:col-span-full md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]"
    >
      {track ? (
        <NowPlayingView open={open} onOpenChange={setOpen} layoutId={COVER_LAYOUT_ID}>
          <NowPlaying
            track={track}
            layoutId={COVER_LAYOUT_ID}
            wrapCover={(cover) => (
              <NowPlayingTrigger>
                <button
                  type="button"
                  aria-label={`Open Now Playing: ${track.title} by ${track.artist.name}`}
                  className="shrink-0 rounded-md"
                >
                  {cover}
                </button>
              </NowPlayingTrigger>
            )}
          />
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
            <NowPlayingTrigger>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Open Now Playing"
                className="text-muted-foreground hover:text-foreground rounded-full"
              >
                <Maximize2 aria-hidden="true" className="size-5" />
              </Button>
            </NowPlayingTrigger>
          </div>
        </NowPlayingView>
      ) : (
        <div className="col-span-full flex items-center gap-3">
          <Music aria-hidden="true" className="text-muted-foreground size-5" />
          <p className="text-muted-foreground text-sm">Nothing playing yet.</p>
        </div>
      )}
    </section>
  );
}
