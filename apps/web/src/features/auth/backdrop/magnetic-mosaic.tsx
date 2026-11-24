'use client';

import { useReducedMotion } from 'motion/react';
import { type PointerEvent, useEffect, useRef } from 'react';
import type { ImageSet } from '@/lib/api/catalog';
import { BackdropTile, fillCovers, lerp, useAnimationFrame, usePointer } from './shared';

const TILES = 144;
/** Distance (px) at which a cover stops reacting to the mouse. */
const REACH = 230;
const WAVE_SPEED = 0.85;
const WAVE_WIDTH = 70;
const WAVE_LIFETIME = 1100;

interface Wave {
  x: number;
  y: number;
  start: number;
}

/**
 * A grayscale wall of covers that comes alive around the mouse, like a
 * magnifying glass over the library. Clicking the background sends a wave
 * through it. Inspired by React Bits ("Dot Grid") and Magic UI.
 */
export function MagneticMosaic({ covers }: { covers: readonly ImageSet[] }) {
  const root = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLElement | null)[]>([]);
  const centers = useRef<{ x: number; y: number }[]>([]);
  const levels = useRef<number[]>([]);
  const waves = useRef<Wave[]>([]);
  const smooth = useRef({ x: -1, y: -1 });
  const pointer = usePointer(root);
  const reduceMotion = useReducedMotion() ?? false;

  // Tile centers only change with the layout, so they are measured on resize.
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const origin = element.getBoundingClientRect();
      centers.current = tiles.current.map((tile) => {
        const rect = tile?.getBoundingClientRect();
        return rect
          ? {
              x: rect.left - origin.left + rect.width / 2,
              y: rect.top - origin.top + rect.height / 2,
            }
          : { x: -1e4, y: -1e4 };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useAnimationFrame((now) => {
    const element = root.current;
    if (!element) {
      return;
    }
    const target = pointer.current;
    const s = smooth.current;
    if (target.active) {
      s.x = s.x < 0 ? target.x : lerp(s.x, target.x, 0.15);
      s.y = s.y < 0 ? target.y : lerp(s.y, target.y, 0.15);
    } else {
      // Without a mouse (touch screens), a light wanders across the wall.
      const { width, height } = element.getBoundingClientRect();
      const t = now / 1000;
      s.x = lerp(s.x < 0 ? width / 2 : s.x, width * (0.5 + 0.38 * Math.sin(t * 0.31)), 0.05);
      s.y = lerp(s.y < 0 ? height / 2 : s.y, height * (0.5 + 0.34 * Math.sin(t * 0.47 + 1)), 0.05);
    }
    waves.current = waves.current.filter((wave) => now - wave.start < WAVE_LIFETIME);

    centers.current.forEach((center, index) => {
      let level = Math.max(0, 1 - Math.hypot(center.x - s.x, center.y - s.y) / REACH);
      for (const wave of waves.current) {
        const front = (now - wave.start) * WAVE_SPEED;
        const distance = Math.hypot(center.x - wave.x, center.y - wave.y);
        level = Math.max(level, Math.max(0, 1 - Math.abs(distance - front) / WAVE_WIDTH) * 0.9);
      }
      const eased = level * level * (3 - 2 * level);
      if (Math.abs(eased - (levels.current[index] ?? -1)) < 0.004) {
        return;
      }
      levels.current[index] = eased;
      const tile = tiles.current[index];
      if (!tile) {
        return;
      }
      tile.style.transform = `translateY(${-eased * 6}px) scale(${1 + eased * 0.28})`;
      tile.style.filter = `grayscale(${1 - eased}) brightness(${0.45 + eased * 0.7})`;
      tile.style.zIndex = eased > 0.05 ? '1' : '0';
      tile.style.boxShadow =
        eased > 0.3
          ? `0 0 0 1px color-mix(in srgb, var(--accent) ${Math.round(eased * 80)}%, transparent), 0 14px 30px -10px color-mix(in srgb, var(--accent) ${Math.round(eased * 70)}%, transparent)`
          : 'none';
    });
  }, !reduceMotion);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const element = root.current;
    if (!element || reduceMotion) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    waves.current.push({ x, y, start: performance.now() });
    const ring = document.createElement('span');
    ring.className =
      'border-brand-2 pointer-events-none absolute z-10 size-5 -translate-1/2 rounded-full border-2';
    Object.assign(ring.style, { left: `${x}px`, top: `${y}px` });
    element.appendChild(ring);
    ring
      .animate(
        [
          { width: '20px', height: '20px', opacity: 1 },
          { width: '900px', height: '900px', opacity: 0 },
        ],
        { duration: 1000, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      )
      .addEventListener('finish', () => ring.remove());
  };

  return (
    <div ref={root} onPointerDown={onPointerDown} className="absolute inset-0 overflow-hidden">
      <div className="absolute -inset-5 grid grid-cols-6 content-start gap-2.5 p-2.5 sm:grid-cols-9 lg:grid-cols-12">
        {fillCovers(covers, TILES).map((cover, index) => (
          <div
            key={index}
            ref={(tile) => {
              tiles.current[index] = tile;
            }}
            className="relative aspect-square rounded-lg will-change-transform"
            style={{
              filter: reduceMotion
                ? 'grayscale(0.4) brightness(0.6)'
                : 'grayscale(1) brightness(0.45)',
            }}
          >
            <BackdropTile cover={cover} sizes="160px" className="size-full rounded-lg" />
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(60% 70% at 50% 50%, color-mix(in srgb, var(--bg) 35%, transparent), color-mix(in srgb, var(--bg) 85%, transparent))',
        }}
      />
    </div>
  );
}
