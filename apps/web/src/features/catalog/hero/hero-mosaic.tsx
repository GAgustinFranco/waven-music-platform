'use client';

import { type PointerEvent, useRef } from 'react';
import { BackdropTile, fillCovers, lerp, useAnimationFrame } from '@/features/auth/backdrop/shared';
import type { ImageSet } from '@/lib/api/catalog';
import { type HeroDesignProps, localPointer } from './hero-shared';

const ROWS = 3;
const PER_ROW = 14;

/** The rows twice (gray and lit), with identical timing so they stay aligned. */
function Rows({ covers }: { covers: readonly ImageSet[] }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2.5">
      {Array.from({ length: ROWS }, (_, row) => {
        const slots = fillCovers(covers, PER_ROW, row * 5);
        return (
          <div
            key={row}
            className={
              row % 2 === 0
                ? 'motion-safe:animate-marquee-left flex w-max gap-2.5 pr-2.5'
                : 'motion-safe:animate-marquee-right flex w-max gap-2.5 pr-2.5'
            }
            style={{ animationDuration: `${64 + row * 14}s` }}
          >
            {[...slots, ...slots].map((cover, index) => (
              <BackdropTile
                key={index}
                cover={cover}
                sizes="96px"
                className="size-24 shrink-0 rounded-lg"
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Flat rows of covers drifting sideways in grayscale; they light up in color
 * around the mouse, and a click sends a ring through them. Without a mouse the
 * light wanders on its own.
 */
export function HeroMosaic({ covers, pointer, active }: HeroDesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const smooth = useRef({ x: -1, y: -1 });

  useAnimationFrame((now) => {
    const element = root.current;
    if (!element) {
      return;
    }
    const p = localPointer(pointer.current, element);
    const s = smooth.current;
    const t = now / 1000;
    const x = p.inside ? p.x : p.width * (0.68 + 0.22 * Math.sin(t * 0.31));
    const y = p.inside ? p.y : p.height * (0.5 + 0.25 * Math.sin(t * 0.47 + 1));
    s.x = s.x < 0 ? x : lerp(s.x, x, p.inside ? 0.15 : 0.05);
    s.y = s.y < 0 ? y : lerp(s.y, y, p.inside ? 0.15 : 0.05);
    element.style.setProperty('--spot-x', `${s.x}px`);
    element.style.setProperty('--spot-y', `${s.y}px`);
  }, active);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = root.current;
    if (!element || !active) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const ring = document.createElement('span');
    ring.className =
      'border-brand-2 pointer-events-none absolute z-10 size-5 -translate-1/2 rounded-full border-2';
    Object.assign(ring.style, {
      left: `${event.clientX - rect.left}px`,
      top: `${event.clientY - rect.top}px`,
    });
    element.appendChild(ring);
    ring
      .animate(
        [
          { width: '20px', height: '20px', opacity: 1 },
          { width: '640px', height: '640px', opacity: 0 },
        ],
        { duration: 900, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      )
      .addEventListener('finish', () => ring.remove());
  };

  return (
    <div
      ref={root}
      onPointerDown={onPointerDown}
      className="absolute inset-0 overflow-hidden [--spot-x:70%] [--spot-y:50%]"
    >
      <div className="absolute inset-0 opacity-60 brightness-50 grayscale">
        <Rows covers={covers} />
      </div>
      <div
        className="absolute inset-0 saturate-[.9]"
        style={{
          maskImage:
            'radial-gradient(190px circle at var(--spot-x) var(--spot-y), black, transparent 75%)',
        }}
      >
        <Rows covers={covers} />
      </div>
    </div>
  );
}
