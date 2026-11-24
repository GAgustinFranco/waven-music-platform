'use client';

import { useRef } from 'react';
import { BackdropTile, lerp, useAnimationFrame } from '@/features/auth/backdrop/shared';
import { selectCurrentTrack, usePlayerStore } from '@/stores/player.store';
import { type HeroDesignProps, localPointer } from './hero-shared';

/** Degrees per second at full speed: a slow, calm turn, not a real 33⅓ rpm. */
const SPIN = 45;

/**
 * A record sliding out of its sleeve. The sleeve and the label show the album
 * playing (or a catalog cover when nothing plays); the record spins while music
 * plays and a sheen follows the mouse.
 */
export function HeroVinyl({ covers, pointer, active }: HeroDesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const disc = useRef<HTMLDivElement>(null);
  const record = useRef<HTMLDivElement>(null);
  const sheen = useRef<HTMLDivElement>(null);
  const state = useRef({ angle: 0, speed: 0, x: 0, y: 0, last: 0 });
  const playing = usePlayerStore((s) => s.isPlaying);
  const playingCover = usePlayerStore((s) => selectCurrentTrack(s)?.album.cover ?? null);
  const cover = playingCover ?? covers[0] ?? null;

  useAnimationFrame((now) => {
    const element = root.current;
    if (!element || !disc.current || !record.current || !sheen.current) {
      return;
    }
    const s = state.current;
    const dt = s.last === 0 ? 0 : Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    const p = localPointer(pointer.current, element);
    s.speed = lerp(s.speed, playing ? 1 : 0, 0.03);
    s.angle = (s.angle + dt * SPIN * s.speed) % 360;
    s.x = lerp(s.x, p.nx, 0.06);
    s.y = lerp(s.y, p.ny, 0.06);
    record.current.style.transform = `rotate(${s.angle}deg)`;
    disc.current.style.transform = `translateX(${s.x * 14}px)`;
    sheen.current.style.setProperty('--sheen', `${30 + s.x * 80 + s.y * 40}deg`);
  }, active);

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden">
      <div
        ref={disc}
        className="absolute top-14 right-[4%] size-[17.5rem] rounded-full will-change-transform"
      >
        <div
          ref={record}
          className="border-border bg-background absolute inset-0 rounded-full border shadow-2xl will-change-transform"
          style={{
            backgroundImage:
              'repeating-radial-gradient(circle, color-mix(in srgb, var(--text) 5%, transparent) 0 1px, transparent 1px 3px)',
          }}
        >
          <span className="bg-foreground/10 absolute top-3.5 left-1/2 h-10 w-0.5 -translate-x-1/2 rounded-full" />
          <div className="absolute top-1/2 left-1/2 size-26 -translate-1/2 overflow-hidden rounded-full">
            <BackdropTile cover={cover} sizes="104px" className="size-full" />
            <span className="bg-background absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full" />
          </div>
        </div>
        <div
          ref={sheen}
          className="pointer-events-none absolute inset-0 rounded-full mix-blend-screen [--sheen:30deg]"
          style={{
            backgroundImage:
              'conic-gradient(from var(--sheen), transparent 0deg, color-mix(in srgb, var(--text) 10%, transparent) 18deg, transparent 46deg, transparent 180deg, color-mix(in srgb, var(--text) 10%, transparent) 198deg, transparent 226deg)',
          }}
        />
      </div>
      {/* The record slides out to the right, so its label stays clear of the sleeve. */}
      <div className="absolute top-[4.5rem] right-[calc(4%+200px)] z-[1] size-[15.5rem]">
        <BackdropTile cover={cover} sizes="248px" className="size-full rounded-md shadow-2xl" />
      </div>
    </div>
  );
}
