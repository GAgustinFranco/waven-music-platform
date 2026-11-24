'use client';

import { useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import type { ImageSet } from '@/lib/api/catalog';
import { BackdropTile, fillCovers, lerp, useAnimationFrame, usePointer } from './shared';

const COLUMNS = 9;
const PER_COLUMN = 7;

/**
 * Columns of covers on a tilted plane that scroll forever in alternate
 * directions. The mouse tilts the plane and carries a spotlight; the cover under
 * it lifts. Inspired by Aceternity UI's "3D Marquee" and "Spotlight".
 */
export function MarqueeWall({ covers }: { covers: readonly ImageSet[] }) {
  const root = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const pointer = usePointer(root);
  const reduceMotion = useReducedMotion() ?? false;
  const smooth = useRef({ nx: 0, ny: 0, x: 0, y: 0 });

  useAnimationFrame(() => {
    const element = root.current;
    if (!element || !plane.current) {
      return;
    }
    const target = pointer.current;
    const s = smooth.current;
    const rect = element.getBoundingClientRect();
    s.nx = lerp(s.nx, target.active ? target.nx : 0, 0.06);
    s.ny = lerp(s.ny, target.active ? target.ny : 0, 0.06);
    s.x = lerp(s.x, target.active ? target.x : rect.width / 2, 0.15);
    s.y = lerp(s.y, target.active ? target.y : rect.height / 2, 0.15);
    plane.current.style.transform = `translate(-50%, -50%) rotateX(${50 - s.ny * 12}deg) rotateZ(${-35 + s.nx * 12}deg)`;
    element.style.setProperty('--spot-x', `${s.x}px`);
    element.style.setProperty('--spot-y', `${s.y}px`);
  }, !reduceMotion);

  return (
    <div
      ref={root}
      className="absolute inset-0 overflow-hidden [--spot-x:50%] [--spot-y:50%] [perspective:1400px]"
    >
      <div
        ref={plane}
        className="absolute top-1/2 left-1/2 grid h-[170vmax] w-[170vmax] grid-cols-9 gap-4 [transform-style:preserve-3d]"
        style={{ transform: 'translate(-50%, -50%) rotateX(50deg) rotateZ(-35deg)' }}
      >
        {Array.from({ length: COLUMNS }, (_, column) => {
          const slots = fillCovers(covers, PER_COLUMN, column * PER_COLUMN);
          return (
            <div
              key={column}
              className={
                column % 2 === 0
                  ? 'motion-safe:animate-marquee-up flex flex-col gap-4'
                  : 'motion-safe:animate-marquee-down flex flex-col gap-4'
              }
              style={{ animationDuration: `${36 + (column % 3) * 8}s` }}
            >
              {/* Twice, so the -50% loop is seamless. */}
              {[...slots, ...slots].map((cover, index) => (
                <BackdropTile
                  key={index}
                  cover={cover}
                  sizes="300px"
                  className="ease-standard hover:ring-brand aspect-square w-full rounded-lg brightness-75 saturate-[.8] transition-[transform,filter,box-shadow] duration-300 hover:scale-[1.08] hover:brightness-100 hover:saturate-100 hover:ring-2 motion-safe:hover:[transform:translateZ(60px)_scale(1.08)]"
                />
              ))}
            </div>
          );
        })}
      </div>
      {/* A violet light and a spotlight that follow the mouse. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            'radial-gradient(300px circle at var(--spot-x) var(--spot-y), color-mix(in srgb, var(--accent) 28%, transparent), transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(280px circle at var(--spot-x) var(--spot-y), transparent, color-mix(in srgb, var(--bg) 35%, transparent) 45%, color-mix(in srgb, var(--bg) 82%, transparent))',
        }}
      />
    </div>
  );
}
