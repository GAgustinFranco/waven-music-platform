import type { CSSProperties } from 'react';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Inline style for `.dominant-header`. The color is data from the API (already
 * darkened for AA contrast with --text), never a value written in the code; anything
 * that is not a plain hex color is dropped so it cannot inject CSS.
 */
export function dominantColorStyle(color: string | null | undefined): CSSProperties | undefined {
  if (!color || !HEX_COLOR.test(color)) {
    return undefined;
  }
  return { '--dominant-color': color } as CSSProperties;
}
