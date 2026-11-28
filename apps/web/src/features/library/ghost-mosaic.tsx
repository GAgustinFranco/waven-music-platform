'use client';

import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import {
  BackdropTile,
  type BackdropCover,
  fillCovers,
  lerp,
  useAnimationFrame,
  usePointer,
} from '@/features/auth/backdrop/shared';
import { localPointer } from '@/features/catalog/hero/hero-shared';
import { showcaseQuery } from '@/lib/api/catalog';

const TILES = 40;

function Tiles({ covers }: { covers: readonly BackdropCover[] }) {
  return (
    <div className="absolute -inset-4 grid grid-cols-5 content-center gap-2 sm:grid-cols-8 lg:grid-cols-10">
      {covers.map((cover, index) => (
        <BackdropTile
          key={index}
          cover={cover}
          sizes="128px"
          className="aspect-square w-full rounded-md"
        />
      ))}
    </div>
  );
}

/**
 * Decorative backdrop for the library's empty states: showcase covers in
 * grayscale that light up in color around the mouse. Mouse only; a scrim keeps
 * the empty state's text at AA.
 */
export function GhostMosaic() {
  const root = useRef<HTMLDivElement>(null);
  const pointer = usePointer(root);
  const reduced = useReducedMotion();
  const smooth = useRef({ x: -1, y: -1, light: 0 });
  const { data } = useQuery(showcaseQuery());
  const covers = fillCovers(data?.covers ?? [], TILES);

  useAnimationFrame(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const p = localPointer(pointer.current, element);
    const s = smooth.current;
    const follow = reduced ? 1 : 0.18;
    if (p.inside) {
      s.x = s.x < 0 ? p.x : lerp(s.x, p.x, follow);
      s.y = s.y < 0 ? p.y : lerp(s.y, p.y, follow);
    }
    s.light = lerp(s.light, p.inside ? 1 : 0, reduced ? 1 : 0.1);
    element.style.setProperty('--spot-x', `${s.x}px`);
    element.style.setProperty('--spot-y', `${s.y}px`);
    element.style.setProperty('--spot-light', s.light.toFixed(3));
  }, covers.length > 0);

  if (!data || data.covers.length === 0) {
    return null;
  }

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
    >
      <div className="absolute inset-0 opacity-25 grayscale">
        <Tiles covers={covers} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          opacity: 'calc(var(--spot-light, 0) * 0.85)',
          maskImage:
            'radial-gradient(170px circle at var(--spot-x) var(--spot-y), black, transparent 75%)',
        }}
      >
        <Tiles covers={covers} />
      </div>
      <div className="ghost-mosaic-scrim absolute inset-0" />
    </div>
  );
}
