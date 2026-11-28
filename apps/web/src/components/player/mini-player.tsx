'use client';

import { useState } from 'react';
import { NowPlayingTrigger, NowPlayingView } from '@/features/player/now-playing/now-playing-view';
import { selectCurrentTrack, usePlayerStore } from '@/stores/player.store';
import { PlayPauseButton } from './controls';
import { NowPlaying } from './now-playing';
import { ProgressLine } from './seek-bar';

const COVER_LAYOUT_ID = 'now-playing-cover-mini';

/**
 * Mobile (< 768 px): a mini player above the bottom navigation that opens the
 * full-screen Now Playing view.
 */
export function MiniPlayer() {
  const track = usePlayerStore(selectCurrentTrack);
  const [open, setOpen] = useState(false);

  if (!track) {
    return null;
  }

  return (
    <section aria-label="Player" className="bg-surface-2 relative md:hidden">
      <NowPlayingView open={open} onOpenChange={setOpen} layoutId={COVER_LAYOUT_ID}>
        <div className="h-mini-player px-gutter flex items-center gap-3">
          <NowPlayingTrigger>
            <button
              type="button"
              aria-label={`Open Now Playing: ${track.title} by ${track.artist.name}`}
              className="min-w-0 flex-1 rounded-md text-left"
            >
              <NowPlaying track={track} links={false} layoutId={COVER_LAYOUT_ID} />
            </button>
          </NowPlayingTrigger>
          <PlayPauseButton size="sm" />
        </div>
      </NowPlayingView>
      <ProgressLine className="absolute inset-x-0 bottom-0" />
    </section>
  );
}
