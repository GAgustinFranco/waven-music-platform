'use client';

import { useRef, useState } from 'react';
import { cn } from 'cn';
import { Slider } from '@/components/ui/slider';
import { audioEngine } from '@/features/player/audio-engine';
import { describeDuration, formatDuration } from '@/lib/format';
import { usePlayerStore } from '@/stores/player.store';

/** Position slider with elapsed and total times. Seeks on release, not while dragging. */
export function SeekBar({ className }: { className?: string }) {
  const currentTimeMs = usePlayerStore((state) => state.currentTimeMs);
  const durationMs = usePlayerStore((state) => state.durationMs);
  const playbackKey = usePlayerStore((state) => state.playbackKey);
  // Tied to the track: Radix also reports a value change (with no commit) when
  // `max` shrinks for a shorter track, which must not leave a stale drag behind.
  const [drag, setDrag] = useState<{ key: number; ms: number } | null>(null);
  const interacting = useRef(false);
  const dragMs = drag?.key === playbackKey ? drag.ms : null;
  const shownMs = Math.min(dragMs ?? currentTimeMs, durationMs);

  return (
    <div className={cn('flex w-full items-center gap-2', className)}>
      <span className="text-muted-foreground w-[5ch] text-right font-mono text-xs tabular-nums">
        {formatDuration(shownMs)}
      </span>
      <Slider
        label="Seek"
        valueText={`${describeDuration(shownMs)} of ${describeDuration(durationMs)}`}
        min={0}
        max={Math.max(1, Math.round(durationMs / 1000))}
        step={1}
        disabled={durationMs === 0}
        value={[Math.round(shownMs / 1000)]}
        onPointerDown={() => (interacting.current = true)}
        onKeyDown={() => (interacting.current = true)}
        onBlur={() => (interacting.current = false)}
        onValueChange={([seconds = 0]) => {
          if (interacting.current) {
            setDrag({ key: playbackKey, ms: seconds * 1000 });
          }
        }}
        onValueCommit={([seconds = 0]) => {
          interacting.current = false;
          setDrag(null);
          audioEngine.seek(seconds * 1000);
        }}
      />
      <span className="text-muted-foreground w-[5ch] font-mono text-xs tabular-nums">
        {formatDuration(durationMs)}
      </span>
    </div>
  );
}

/** Thin, non-interactive progress line (mini player). */
export function ProgressLine({ className }: { className?: string }) {
  const progress = usePlayerStore((state) =>
    state.durationMs > 0 ? Math.min(1, state.currentTimeMs / state.durationMs) : 0,
  );
  return (
    <div aria-hidden="true" className={cn('bg-elevated h-0.5 w-full', className)}>
      <div
        className="bg-foreground h-full origin-left"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
