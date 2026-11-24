'use client';

import {
  LoaderCircle,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { usePlayerStore } from '@/stores/player.store';

const ICON_BUTTON = 'text-muted-foreground hover:text-foreground rounded-full';
const ACTIVE = 'text-brand hover:text-brand-hover';

/** Round brand play/pause. `size` is the button's diameter. */
export function PlayPauseButton({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const buffering = usePlayerStore((state) => state.buffering && state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const Icon = buffering ? LoaderCircle : isPlaying ? Pause : Play;

  return (
    <Button
      type="button"
      aria-label={isPlaying ? 'Pause' : 'Play'}
      onClick={togglePlay}
      className={cn(
        'bg-foreground text-background hover:bg-foreground/90 rounded-full hover:scale-105',
        size === 'sm' && 'size-9',
        size === 'md' && 'size-10',
        size === 'lg' && 'size-16',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'fill-current',
          size === 'lg' ? 'size-7' : 'size-5',
          buffering && 'animate-spin fill-none motion-reduce:animate-none',
        )}
      />
    </Button>
  );
}

export function PreviousButton({ className }: { className?: string }) {
  const previous = usePlayerStore((state) => state.previous);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label="Previous"
      onClick={previous}
      className={cn(ICON_BUTTON, className)}
    >
      <SkipBack aria-hidden="true" className="size-5 fill-current" />
    </Button>
  );
}

export function NextButton({ className }: { className?: string }) {
  const next = usePlayerStore((state) => state.next);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label="Next"
      onClick={() => next()}
      className={cn(ICON_BUTTON, className)}
    >
      <SkipForward aria-hidden="true" className="size-5 fill-current" />
    </Button>
  );
}

export function ShuffleButton({ className }: { className?: string }) {
  const shuffle = usePlayerStore((state) => state.shuffle);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label="Shuffle"
      aria-pressed={shuffle}
      onClick={() => toggleShuffle()}
      className={cn(ICON_BUTTON, shuffle && ACTIVE, className)}
    >
      <Shuffle aria-hidden="true" className="size-5" />
    </Button>
  );
}

const REPEAT_LABEL = {
  off: 'Repeat: off',
  all: 'Repeat: all',
  one: 'Repeat: one track',
} as const;

export function RepeatButton({ className }: { className?: string }) {
  const repeat = usePlayerStore((state) => state.repeat);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const Icon = repeat === 'one' ? Repeat1 : Repeat;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label={REPEAT_LABEL[repeat]}
      onClick={cycleRepeat}
      className={cn(ICON_BUTTON, repeat !== 'off' && ACTIVE, className)}
    >
      <Icon aria-hidden="true" className="size-5" />
    </Button>
  );
}

/** Shuffle · previous · play/pause · next · repeat. */
export function TransportControls({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className={cn('flex items-center justify-center', size === 'lg' ? 'gap-4' : 'gap-2')}>
      <ShuffleButton />
      <PreviousButton />
      <PlayPauseButton size={size} />
      <NextButton />
      <RepeatButton />
    </div>
  );
}

export function VolumeControl() {
  const volume = usePlayerStore((state) => state.volume);
  const muted = usePlayerStore((state) => state.muted);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={toggleMute}
        className={ICON_BUTTON}
      >
        <Icon aria-hidden="true" className="size-5" />
      </Button>
      <Slider
        label="Volume"
        valueText={`${Math.round(level * 100)}%`}
        className="w-24"
        min={0}
        max={100}
        step={5}
        value={[Math.round(level * 100)]}
        onValueChange={([value = 0]) => setVolume(value / 100)}
      />
    </div>
  );
}
