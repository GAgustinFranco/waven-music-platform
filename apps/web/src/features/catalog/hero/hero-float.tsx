'use client';

import { cn } from 'cn';
import { useRef } from 'react';
import { BackdropTile, fillCovers, lerp, useAnimationFrame } from '@/features/auth/backdrop/shared';
import { type HeroDesignProps, localPointer } from './hero-shared';

/** [left %, top %, size px] per cover; farther layers are smaller, dimmer and blurred. */
const LAYERS = [
  {
    depth: 1,
    className: 'opacity-45 blur-[1.5px]',
    spots: [
      [49, 24, 58],
      [60, 72, 54],
      [90, 22, 62],
      [96, 70, 50],
    ],
  },
  {
    depth: 2,
    className: 'opacity-80',
    spots: [
      [54, 46, 92],
      [76, 18, 84],
      [86, 62, 96],
    ],
  },
  {
    depth: 3,
    className: '[&_img]:ring-brand/40 [&_img]:ring-1',
    spots: [[66, 30, 150]],
  },
] as const;

/**
 * An aurora in the theme's colors with covers floating in three layers; the
 * mouse moves each layer at its own speed (parallax). Without a mouse the
 * scene sways gently.
 */
export function HeroFloat({ covers, pointer, active }: HeroDesignProps) {
  const root = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const smooth = useRef({ x: 0, y: 0 });

  useAnimationFrame((now) => {
    const element = root.current;
    if (!element) {
      return;
    }
    const p = localPointer(pointer.current, element);
    const s = smooth.current;
    const t = now / 1000;
    s.x = lerp(s.x, p.inside ? p.nx : 0.25 * Math.sin(t * 0.4), 0.07);
    s.y = lerp(s.y, p.inside ? p.ny : 0.2 * Math.sin(t * 0.3), 0.07);
    LAYERS.forEach((layer, index) => {
      const element = layers.current[index];
      if (element) {
        element.style.transform = `translate3d(${-s.x * 44 * layer.depth}px, ${-s.y * 32 * layer.depth}px, 0)`;
      }
    });
  }, active);

  let next = 0;
  const slots = fillCovers(covers, 8, 3);

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden">
      <div
        className="motion-safe:animate-aurora absolute -inset-[40%] blur-[70px]"
        style={{
          backgroundImage:
            'conic-gradient(from 0deg at 65% 45%, transparent, color-mix(in srgb, var(--accent) 38%, transparent), color-mix(in srgb, var(--accent-2) 24%, transparent), transparent)',
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
                  width: `${size}px`,
                  marginLeft: `${-size / 2}px`,
                  animationDelay: `${-(index * 3 + spot) * 1.3}s`,
                }}
              >
                <BackdropTile
                  cover={cover}
                  sizes={`${size}px`}
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
