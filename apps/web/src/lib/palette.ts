import { contrastRatio } from './theme';

/** Hue 0–360, saturation and lightness 0–1. */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** CSS custom properties of the Dynamic theme, all derived from one cover color. */
export interface DynamicPalette {
  bg: string;
  surface: string;
  surface2: string;
  elevated: string;
  border: string;
  borderStrong: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accent2: string;
  glow: string;
}

const HUE_BINS = 24;
/** Pixels below this saturation are treated as gray. */
const MIN_PIXEL_SATURATION = 0.12;
/** The weighted share of colorful pixels a cover needs to count as colored. */
const MIN_COLOR_SHARE = 0.01;

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d) % 6;
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: Math.min(s, 1), l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function hexToHsl(hex: string): Hsl | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 16);
  return rgbToHsl((value >> 16) & 255, (value >> 8) & 255, value & 255);
}

/**
 * The most vibrant representative color of an image (RGBA pixels, as from
 * `getImageData`). Pixels vote for a hue bin, weighted by how saturated they are
 * and how far from black or white; the winning bin's average is returned. A
 * grayscale image still gives a color (saturation near 0), so the theme turns
 * silver instead of keeping the default.
 */
export function pickVibrantColor(pixels: Uint8ClampedArray): Hsl | null {
  const weight = new Array<number>(HUE_BINS).fill(0);
  const sumX = new Array<number>(HUE_BINS).fill(0);
  const sumY = new Array<number>(HUE_BINS).fill(0);
  const sumS = new Array<number>(HUE_BINS).fill(0);
  let count = 0;
  let sumL = 0;

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) {
      continue;
    }
    const { h, s, l } = rgbToHsl(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0);
    count += 1;
    sumL += l;
    // Near-gray pixels carry no hue. Mid lightness counts most, but dark tones
    // (a burgundy, a navy) still count: many covers are mostly dark.
    if (s < MIN_PIXEL_SATURATION) {
      continue;
    }
    const body = Math.max(0, 1 - Math.abs(l - 0.5) * 2);
    const w = s * Math.sqrt(body);
    if (w <= 0) {
      continue;
    }
    const bin = Math.floor(h / (360 / HUE_BINS)) % HUE_BINS;
    const angle = (h * Math.PI) / 180;
    weight[bin] = (weight[bin] ?? 0) + w;
    sumX[bin] = (sumX[bin] ?? 0) + Math.cos(angle) * w;
    sumY[bin] = (sumY[bin] ?? 0) + Math.sin(angle) * w;
    sumS[bin] = (sumS[bin] ?? 0) + s * w;
  }

  if (count === 0) {
    return null;
  }
  let best = 0;
  for (let bin = 1; bin < HUE_BINS; bin += 1) {
    if ((weight[bin] ?? 0) > (weight[best] ?? 0)) {
      best = bin;
    }
  }
  const total = weight[best] ?? 0;
  // Hardly any of the image is colorful: treat it as grayscale.
  if (total < count * MIN_COLOR_SHARE) {
    return { h: 0, s: 0, l: sumL / count };
  }
  const h = ((Math.atan2(sumY[best] ?? 0, sumX[best] ?? 0) * 180) / Math.PI + 360) % 360;
  return { h, s: (sumS[best] ?? 0) / total, l: 0.5 };
}

/** Raises the lightness until the color reaches `ratio` against `bg`. */
function readableOn(color: Hsl, bg: string, ratio: number): string {
  for (let l = color.l; l <= 0.97; l += 0.01) {
    const hex = hslToHex({ ...color, l });
    if (contrastRatio(hex, bg) >= ratio) {
      return hex;
    }
  }
  return hslToHex({ ...color, l: 0.97 });
}

/**
 * Builds the whole Dynamic theme from one cover color: very dark surfaces in
 * the cover's hue (so white text keeps its contrast), a vivid accent that reaches
 * 4.5:1 on them, and a stronger glow. Grayscale covers give a silver theme.
 */
export function dynamicPalette(cover: Hsl): DynamicPalette {
  const gray = cover.s < 0.08;
  const h = cover.h;
  const tint = gray ? 0 : Math.min(0.45, Math.max(0.25, cover.s * 0.5));
  const surface = (l: number, s = tint) => hslToHex({ h, s, l });
  const bg = surface(0.055);
  const surface2 = surface(0.13, tint * 0.9);
  const accentBase: Hsl = gray
    ? { h, s: 0.06, l: 0.7 }
    : { h, s: Math.min(0.9, Math.max(0.6, cover.s)), l: 0.55 };
  const accent = readableOn(accentBase, surface2, 4.5);
  const accentHsl = hexToHsl(accent) ?? accentBase;
  return {
    bg,
    surface: surface(0.095),
    surface2,
    elevated: surface(0.17, tint * 0.8),
    border: surface(0.2, tint * 0.6),
    borderStrong: readableOn({ h, s: tint * 0.5, l: 0.4 }, surface(0.17, tint * 0.8), 3),
    textMuted: readableOn({ h, s: Math.min(tint, 0.2), l: 0.68 }, surface(0.17, tint * 0.8), 4.5),
    accent,
    accentHover: hslToHex({ ...accentHsl, l: Math.min(0.92, accentHsl.l + 0.08) }),
    accent2: hslToHex({ h: (h + 40) % 360, s: accentBase.s, l: accentHsl.l }),
    glow: `hsl(${Math.round(h)} ${Math.round((gray ? 0.05 : accentBase.s) * 100)}% 55% / 32%)`,
  };
}
