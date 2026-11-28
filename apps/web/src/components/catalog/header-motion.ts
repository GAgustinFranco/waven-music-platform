/**
 * Scroll choreography of `DominantHeader`, as fractions of the header scrolled
 * past the top of the app's scroll container (0 = at rest, 1 = fully gone).
 */
interface ScrollMapping {
  /** Scroll progress, [from, to]. */
  range: [number, number];
  /** Value at each end of `range`. */
  output: [number, number];
}

export const HEADER_MOTION: Record<'coverScale' | 'textOpacity' | 'barOpacity', ScrollMapping> = {
  /** The cover shrinks to 80 % while the header leaves. */
  coverScale: { range: [0, 0.7], output: [1, 0.8] },
  /** Kind, title and meta fade out first. */
  textOpacity: { range: [0, 0.5], output: [1, 0] },
  /** The compact bar fades in as the header's bottom reaches the app header. */
  barOpacity: { range: [0.6, 0.8], output: [0, 1] },
};

/** The compact bar is interactive (not `inert`) from this point on. */
export const BAR_SHOWN_AT = HEADER_MOTION.barOpacity.range[0];

export const isBarShown = (progress: number) => progress > BAR_SHOWN_AT;

/** Mouse position inside the header as CSS percentages, clamped to the box. */
export function glarePosition(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: string; y: string } {
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  const x = rect.width > 0 ? clamp(((clientX - rect.left) / rect.width) * 100) : 50;
  const y = rect.height > 0 ? clamp(((clientY - rect.top) / rect.height) * 100) : 50;
  return { x: `${x.toFixed(1)}%`, y: `${y.toFixed(1)}%` };
}
