'use client';

import { cn } from 'cn';
import { type RefObject, useEffect, useRef } from 'react';
import type { ImageSet } from '@/lib/api/catalog';

/** `null` paints an empty tile, so the backdrop keeps its shape without covers. */
export type BackdropCover = ImageSet | null;

/** Repeats the covers to fill `count` slots, starting at `offset`. */
export function fillCovers(
  covers: readonly ImageSet[],
  count: number,
  offset = 0,
): BackdropCover[] {
  return Array.from({ length: count }, (_, index) =>
    covers.length === 0 ? null : (covers[(index + offset) % covers.length] ?? null),
  );
}

export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

/** A decorative cover: hidden from assistive technology, never focusable. */
export function BackdropTile({
  cover,
  sizes,
  className,
}: {
  cover: BackdropCover;
  sizes: string;
  className?: string;
}) {
  if (!cover) {
    return <div className={cn('bg-surface-2', className)} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the API already resizes covers (see CoverImage).
    <img
      src={cover.md}
      srcSet={`${cover.sm} 64w, ${cover.md} 300w, ${cover.lg} 640w`}
      sizes={sizes}
      alt=""
      draggable={false}
      decoding="async"
      className={cn('bg-surface-2 object-cover select-none', className)}
    />
  );
}

export interface PointerState {
  /** Position inside the backdrop, in px. */
  x: number;
  y: number;
  /** -0.5 … 0.5 from the center; 0 when there is no pointer. */
  nx: number;
  ny: number;
  /** False until a mouse or pen moves, so touch screens animate on their own. */
  active: boolean;
}

/**
 * Tracks the mouse over the whole window (the sign-in card sits on top of the
 * backdrop) relative to `container`, without re-rendering.
 */
export function usePointer(container: RefObject<HTMLElement | null>): RefObject<PointerState> {
  const pointer = useRef<PointerState>({ x: 0, y: 0, nx: 0, ny: 0, active: false });
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const element = container.current;
      if (!element || event.pointerType === 'touch') {
        return;
      }
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer.current = {
        x,
        y,
        nx: x / rect.width - 0.5,
        ny: y / rect.height - 0.5,
        active: true,
      };
    };
    const onLeave = () => {
      pointer.current = { ...pointer.current, active: false };
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [container]);
  return pointer;
}

/** Runs `frame` on every animation frame while mounted and `enabled`. */
export function useAnimationFrame(frame: (now: number) => void, enabled: boolean): void {
  const latest = useRef(frame);
  useEffect(() => {
    latest.current = frame;
  });
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let id = requestAnimationFrame(function loop(now) {
      latest.current(now);
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [enabled]);
}
