'use client';

import { useRef } from 'react';
import { BackdropTile, fillCovers, lerp, useAnimationFrame } from '@/features/auth/backdrop/shared';
import { type HeroDesignProps, localPointer } from './hero-shared';

const COLUMNS = 8;
const PER_COLUMN = 6;

/**
 * The sign-in wall in a band: columns of covers scrolling on a tilted plane,
 * with a light that follows the mouse and a slight tilt towards it.
 */
export function HeroWall({ covers, pointer, active }: HeroDesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const smooth = useRef({ nx: 0, ny: 0, x: -1, y: -1 });

  useAnimationFrame(() => {
    const element = root.current;
    if (!element || !plane.current) {
      return;
    }
    const p = localPointer(pointer.current, element);
    const s = smooth.current;
    s.nx = lerp(s.nx, p.nx, 0.06);
    s.ny = lerp(s.ny, p.ny, 0.06);
    const x = p.inside ? p.x : p.width * 0.7;
    const y = p.inside ? p.y : p.height * 0.5;
    s.x = s.x < 0 ? x : lerp(s.x, x, 0.15);
    s.y = s.y < 0 ? y : lerp(s.y, y, 0.15);
    plane.current.style.transform = `translate(-50%, -50%) rotateX(${50 - s.ny * 10}deg) rotateZ(${-32 + s.nx * 10}deg)`;
    element.style.setProperty('--spot-x', `${s.x}px`);
    element.style.setProperty('--spot-y', `${s.y}px`);
  }, active);

  return (
    <div
      ref={root}
      className="absolute inset-0 overflow-hidden [--spot-x:70%] [--spot-y:50%] [perspective:1200px]"
    >
      <div
        ref={plane}
        className="absolute top-1/2 left-[64%] grid w-[1150px] grid-cols-8 gap-3.5 [transform-style:preserve-3d]"
        style={{ transform: 'translate(-50%, -50%) rotateX(50deg) rotateZ(-32deg)' }}
      >
        {Array.from({ length: COLUMNS }, (_, column) => {
          const slots = fillCovers(covers, PER_COLUMN, column * PER_COLUMN);
          return (
            <div
              key={column}
              className={
                column % 2 === 0
                  ? 'motion-safe:animate-marquee-up flex flex-col gap-3.5'
                  : 'motion-safe:animate-marquee-down flex flex-col gap-3.5'
              }
              style={{ animationDuration: `${38 + (column % 3) * 9}s` }}
            >
              {[...slots, ...slots].map((cover, index) => (
                <BackdropTile
                  key={index}
                  cover={cover}
                  sizes="160px"
                  className="aspect-square w-full rounded-lg brightness-75 saturate-[.85]"
                />
              ))}
            </div>
          );
        })}
      </div>
      <div
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            'radial-gradient(260px circle at var(--spot-x) var(--spot-y), color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(260px circle at var(--spot-x) var(--spot-y), transparent, color-mix(in srgb, var(--bg) 40%, transparent) 70%)',
        }}
      />
    </div>
  );
}
