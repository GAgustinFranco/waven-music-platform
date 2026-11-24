'use client';

import { useRef } from 'react';
import { BackdropTile, fillCovers, lerp, useAnimationFrame } from '@/features/auth/backdrop/shared';
import { usePlayerStore } from '@/stores/player.store';
import { type HeroDesignProps, localPointer } from './hero-shared';

const COUNT = 10;
const RADIUS = 290;

const transformAt = (angle: number) =>
  `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${RADIUS}px)`;

/** Covers facing away fade out, so the ring reads front to back. */
const brightnessAt = (angle: number) =>
  `brightness(${(0.3 + 0.7 * ((Math.cos((angle * Math.PI) / 180) + 1) / 2)).toFixed(3)})`;

/**
 * A ring of covers turning slowly in 3D. It turns a little faster while music
 * plays, and the mouse swings it to either side.
 */
export function HeroFlow({ covers, pointer, active }: HeroDesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const state = useRef({ angle: 0, offset: 0, speed: 0, last: 0 });
  const playing = usePlayerStore((s) => s.isPlaying);

  useAnimationFrame((now) => {
    const element = root.current;
    if (!element) {
      return;
    }
    const s = state.current;
    const dt = s.last === 0 ? 0 : Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    const p = localPointer(pointer.current, element);
    s.speed = lerp(s.speed, playing ? 1 : 0, 0.02);
    s.angle -= dt * (5 + 7 * s.speed);
    s.offset = lerp(s.offset, p.nx * 70, 0.05);
    items.current.forEach((item, index) => {
      if (!item) {
        return;
      }
      const angle = s.angle + s.offset + (index * 360) / COUNT;
      item.style.transform = transformAt(angle);
      item.style.filter = brightnessAt(angle);
    });
  }, active);

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden [perspective:1000px]">
      <div
        className="absolute top-1/2 left-[68%] h-64 w-[32rem] -translate-1/2 rounded-full blur-[50px]"
        style={{
          backgroundImage:
            'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 30%, transparent), transparent)',
        }}
      />
      {/* Pushed back by the radius, so the front cover keeps its real size. */}
      <div className="absolute top-[54%] left-[68%] [transform:translateZ(-290px)_rotateX(-8deg)] [transform-style:preserve-3d]">
        {fillCovers(covers, COUNT, 6).map((cover, index) => {
          const angle = (index * 360) / COUNT;
          return (
            <div
              key={index}
              ref={(item) => {
                items.current[index] = item;
              }}
              className="absolute top-0 left-0 size-32 will-change-transform"
              style={{ transform: transformAt(angle), filter: brightnessAt(angle) }}
            >
              <BackdropTile
                cover={cover}
                sizes="128px"
                className="size-full rounded-lg shadow-2xl"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
