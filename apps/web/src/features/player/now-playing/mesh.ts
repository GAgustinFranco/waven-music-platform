import type { DynamicPalette } from '@/lib/palette';

/**
 * The theme tokens the Now Playing view overrides with the cover's palette, so
 * every utility inside it (`bg-background`, `text-brand`, …) follows the cover.
 */
const PALETTE_TOKENS: Partial<Record<keyof DynamicPalette, string>> = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  elevated: '--elevated',
  border: '--border',
  borderStrong: '--border-strong',
  textMuted: '--text-muted',
  accent: '--accent',
  accentHover: '--accent-hover',
  accent2: '--accent-2',
  glow: '--glow',
};

/** The palette as scoped CSS custom properties (`style` of the dialog). */
export function paletteTokens(palette: DynamicPalette | null): Record<string, string> {
  if (!palette) {
    return {};
  }
  const tokens: Record<string, string> = {};
  for (const [key, name] of Object.entries(PALETTE_TOKENS)) {
    tokens[name] = palette[key as keyof DynamicPalette];
  }
  return tokens;
}

/** One blurred blob of the mesh: where it rests and how it drifts (in % of the view). */
export interface MeshBlob {
  /** Resting center. */
  x: number;
  y: number;
  /** Drift amplitude. */
  dx: number;
  dy: number;
  /** Phase multipliers; distinct, so the pattern never visibly repeats. */
  fx: number;
  fy: number;
}

/** Four blobs, one per mesh color (accent, accent-2, glow, surface-2 in globals.css). */
export const MESH_BLOBS: readonly MeshBlob[] = [
  { x: 20, y: 15, dx: 14, dy: 10, fx: 1, fy: 1.3 },
  { x: 80, y: 25, dx: 12, dy: 14, fx: 0.7, fy: 1.1 },
  { x: 70, y: 85, dx: 16, dy: 9, fx: 1.2, fy: 0.8 },
  { x: 15, y: 75, dx: 10, dy: 12, fx: 0.9, fy: 1.5 },
];

/** Phase advance per second at full speed (radians). */
export const MESH_RATE = 0.35;
/** The share of the full speed kept while paused. */
export const PAUSED_SPEED = 0.15;
/** How fast the speed eases toward its target, per second. */
const SPEED_EASING = 1.5;

export interface MeshClock {
  phase: number;
  speed: number;
}

/**
 * Advances the mesh by `dt` seconds: the speed eases toward 1 while playing and
 * toward `PAUSED_SPEED` while paused, and the phase moves at that speed. Long
 * gaps (a hidden tab) are clamped, so the blobs never jump.
 */
export function stepMesh(clock: MeshClock, dt: number, playing: boolean): MeshClock {
  const step = Math.min(Math.max(dt, 0), 0.1);
  const target = playing ? 1 : PAUSED_SPEED;
  const amount = Math.min(1, step * SPEED_EASING);
  const speed = clock.speed + (target - clock.speed) * amount;
  return { phase: clock.phase + step * speed * MESH_RATE, speed };
}

/** The blob's offset from its resting center at `phase`, in % of the view. */
export function blobOffset(blob: MeshBlob, phase: number): { x: number; y: number } {
  return {
    x: Math.sin(phase * blob.fx) * blob.dx,
    y: Math.cos(phase * blob.fy) * blob.dy,
  };
}
