import { describe, expect, it } from 'vitest';
import { dynamicPalette } from '@/lib/palette';
import { MESH_BLOBS, MESH_RATE, PAUSED_SPEED, blobOffset, paletteTokens, stepMesh } from './mesh';

describe('paletteTokens', () => {
  it('maps the palette onto the theme tokens', () => {
    const palette = dynamicPalette({ h: 200, s: 0.7, l: 0.5 });
    const tokens = paletteTokens(palette);
    expect(tokens['--bg']).toBe(palette.bg);
    expect(tokens['--accent']).toBe(palette.accent);
    expect(tokens['--text-muted']).toBe(palette.textMuted);
    expect(Object.keys(tokens)).toHaveLength(11);
  });

  it('keeps the current theme without a palette', () => {
    expect(paletteTokens(null)).toEqual({});
  });
});

describe('stepMesh', () => {
  it('eases toward full speed while playing', () => {
    let clock = { phase: 0, speed: PAUSED_SPEED };
    for (let i = 0; i < 300; i += 1) {
      clock = stepMesh(clock, 1 / 60, true);
    }
    expect(clock.speed).toBeGreaterThan(0.99);
    expect(clock.phase).toBeGreaterThan(0);
  });

  it('slows down while paused without stopping', () => {
    let clock = { phase: 0, speed: 1 };
    for (let i = 0; i < 600; i += 1) {
      clock = stepMesh(clock, 1 / 60, false);
    }
    expect(clock.speed).toBeCloseTo(PAUSED_SPEED, 2);
    const next = stepMesh(clock, 1 / 60, false);
    expect(next.phase).toBeGreaterThan(clock.phase);
  });

  it('clamps long gaps so the blobs never jump', () => {
    const clock = stepMesh({ phase: 0, speed: 1 }, 5, true);
    expect(clock.phase).toBeCloseTo(0.1 * MESH_RATE, 5);
  });

  it('ignores negative time', () => {
    expect(stepMesh({ phase: 1, speed: 1 }, -1, true)).toEqual({ phase: 1, speed: 1 });
  });
});

describe('blobOffset', () => {
  it('stays within the drift amplitude', () => {
    for (const blob of MESH_BLOBS) {
      for (let phase = 0; phase < 20; phase += 0.37) {
        const { x, y } = blobOffset(blob, phase);
        expect(Math.abs(x)).toBeLessThanOrEqual(blob.dx);
        expect(Math.abs(y)).toBeLessThanOrEqual(blob.dy);
      }
    }
  });
});
