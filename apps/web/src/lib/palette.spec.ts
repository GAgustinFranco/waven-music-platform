import { describe, expect, it } from 'vitest';
import { dynamicPalette, hexToHsl, hslToHex, pickVibrantColor, rgbToHsl } from './palette';
import { contrastRatio } from './theme';

/** RGBA pixels: `n` copies of each color. */
function pixels(...colors: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(
    colors.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat()),
  );
}

describe('color conversions', () => {
  it('round-trips through HSL', () => {
    for (const hex of ['#ff6f9c', '#2868a8', '#047c7c', '#808080']) {
      expect(hslToHex(hexToHsl(hex) ?? { h: 0, s: 0, l: 0 })).toBe(hex);
    }
  });

  it('reads pure red', () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 1, l: 0.5 });
  });
});

describe('pickVibrantColor', () => {
  it('picks the colorful part of a mostly dark cover', () => {
    // 80% near-black, 20% vivid orange: the old average gave a muddy brown.
    const color = pickVibrantColor(pixels([20, 18, 16, 80], [240, 120, 30, 20]));
    expect(color?.h).toBeGreaterThan(20);
    expect(color?.h).toBeLessThan(35);
    expect(color?.s).toBeGreaterThan(0.6);
  });

  it('prefers a saturated minority over a dull majority', () => {
    const color = pickVibrantColor(pixels([120, 110, 100, 70], [40, 90, 230, 30]));
    expect(color?.h).toBeGreaterThan(210);
    expect(color?.h).toBeLessThan(235);
  });

  it('reports a grayscale cover as gray', () => {
    expect(pickVibrantColor(pixels([30, 30, 30, 50], [200, 200, 200, 50]))?.s).toBe(0);
  });

  it('ignores transparent pixels and empty images', () => {
    expect(pickVibrantColor(new Uint8ClampedArray([255, 0, 0, 0]))).toBeNull();
  });
});

describe('dynamicPalette', () => {
  it.each([
    [{ h: 25, s: 0.85, l: 0.5 }],
    [{ h: 220, s: 0.7, l: 0.5 }],
    [{ h: 330, s: 0.6, l: 0.5 }],
    [{ h: 0, s: 0, l: 0.4 }],
  ])('keeps text and accent readable for %j', (cover) => {
    const palette = dynamicPalette(cover);
    expect(contrastRatio('#f4f4f8', palette.elevated)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.accent, palette.surface2)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.accent, palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.textMuted, palette.elevated)).toBeGreaterThanOrEqual(4.5);
  });

  it('tints the surfaces with the cover hue', () => {
    const orange = hexToHsl(dynamicPalette({ h: 25, s: 0.85, l: 0.5 }).surface2);
    expect(orange?.h).toBeGreaterThan(15);
    expect(orange?.h).toBeLessThan(35);
    expect(orange?.s).toBeGreaterThan(0.2);
  });
});

describe('pickVibrantColor on dark covers', () => {
  it('finds a color in a dark navy and burgundy cover instead of gray', () => {
    const color = pickVibrantColor(pixels([25, 32, 44, 60], [80, 40, 44, 20], [22, 30, 36, 20]));
    expect(color?.s).toBeGreaterThan(0.2);
    // Navy covers most of it, so navy wins.
    expect(color?.h).toBeGreaterThan(200);
    expect(color?.h).toBeLessThan(230);
  });

  it('finds the burgundy when it covers more of the cover', () => {
    const color = pickVibrantColor(pixels([25, 32, 44, 20], [80, 40, 44, 60]));
    expect((color?.h ?? 0) > 330 || (color?.h ?? 360) < 15).toBe(true);
  });
});
