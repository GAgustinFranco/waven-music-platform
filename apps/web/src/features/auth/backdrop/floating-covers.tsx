'use client';

import { cn } from 'cn';
import { useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import type { ImageSet } from '@/lib/api/catalog';
import { BackdropTile, fillCovers, lerp, useAnimationFrame, usePointer } from './shared';

/** [left %, top %, size in vmin] per cover; farther layers are smaller and blurred. */
const LAYERS = [
  {
    depth: 10,
    className: 'opacity-45 blur-[2px]',
    spots: [
      [6, 10, 9],
      [78, 8, 8],
      [60, 72, 7],
      [14, 70, 8.5],
      [88, 48, 6],
      [36, 4, 6],
    ],
  },
  {
    depth: 25,
    className: 'opacity-70',
    spots: [
      [18, 28, 13],
      [74, 24, 12],
      [82, 70, 14],
      [8, 52, 11],
      [52, 80, 10],
    ],
  },
  {
    depth: 45,
    className: 'opacity-95',
    spots: [
      [2, 8, 17],
      [80, 58, 19],
      [28, 74, 15],
    ],
  },
] as const;

/**
 * Covers floating in three layers over a slowly turning aurora. The mouse moves
 * each layer at its own speed (parallax), like the cards on Apple TV.
 */
export function FloatingCovers({ covers }: { covers: readonly ImageSet[] }) {
  const root = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const pointer = usePointer(root);
  const reduceMotion = useReducedMotion() ?? false;
  const smooth = useRef({ x: 0, y: 0 });

  useAnimationFrame((now) => {
    const target = pointer.current;
    const s = smooth.current;
    // Without a mouse, the scene sways gently on its own.
    const t = now / 1000;
    s.x = lerp(s.x, target.active ? target.nx : 0.25 * Math.sin(t * 0.4), 0.07);
    s.y = lerp(s.y, target.active ? target.ny : 0.2 * Math.sin(t * 0.3), 0.07);
    LAYERS.forEach((layer, index) => {
      const element = layers.current[index];
      if (element) {
        element.style.transform = `translate3d(${-s.x * layer.depth * 2}px, ${-s.y * layer.depth * 2}px, 0)`;
      }
    });
  }, !reduceMotion);

  let next = 0;
  const slots = fillCovers(covers, 14, 0);

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden">
      <div
        aria-hidden="true"
        className="motion-safe:animate-aurora absolute -inset-[30%] blur-[80px]"
        style={{
          backgroundImage:
            'conic-gradient(from 0deg at 50% 50%, transparent, color-mix(in srgb, var(--accent) 35%, transparent), color-mix(in srgb, var(--accent-2) 25%, transparent), transparent)',
        }}
      />
      {LAYERS.map((layer, index) => (
        <div
          key={layer.depth}
          ref={(element) => {
            layers.current[index] = element;
          }}
          className="absolute inset-0 will-change-transform"
        >
          {layer.spots.map(([left, top, size], spot) => {
            const cover = slots[next++] ?? null;
            return (
              <div
                key={spot}
                className={cn('motion-safe:animate-bob absolute', layer.className)}
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${size * 1.6}vmin`,
                  animationDelay: `${-spot * 1.7}s`,
                }}
              >
                <BackdropTile
                  cover={cover}
                  sizes="320px"
                  className="aspect-square w-full rounded-xl shadow-2xl"
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
