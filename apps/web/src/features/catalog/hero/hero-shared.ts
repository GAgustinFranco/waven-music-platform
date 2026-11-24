import type { RefObject } from 'react';
import type { PointerState } from '@/features/auth/backdrop/shared';
import type { ImageSet } from '@/lib/api/catalog';

export interface HeroDesignProps {
  covers: readonly ImageSet[];
  /** The mouse relative to the hero (it is tracked over the whole window). */
  pointer: RefObject<PointerState>;
  /** False while the hero is off screen or the user prefers reduced motion. */
  active: boolean;
}

export interface LocalPointer {
  inside: boolean;
  x: number;
  y: number;
  /** -0.5 … 0.5 from the center; 0 while the mouse is elsewhere. */
  nx: number;
  ny: number;
  width: number;
  height: number;
}

/** The pointer, but only while it is over `element`, so moving over the page below does nothing. */
export function localPointer(pointer: PointerState, element: HTMLElement): LocalPointer {
  const { width, height } = element.getBoundingClientRect();
  const inside =
    pointer.active && pointer.x >= 0 && pointer.y >= 0 && pointer.x <= width && pointer.y <= height;
  return {
    inside,
    x: pointer.x,
    y: pointer.y,
    nx: inside ? pointer.nx : 0,
    ny: inside ? pointer.ny : 0,
    width,
    height,
  };
}
