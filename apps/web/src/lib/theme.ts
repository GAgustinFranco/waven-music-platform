import type { components } from './api/schema';

export type Theme = components['schemas']['Theme'];
export type Backdrop = components['schemas']['Backdrop'];

export interface ThemeOption {
  id: Theme;
  name: string;
  note: string;
}

/** Picker order; the first one is Waven's own look and the Free plan's. */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  { id: 'violet', name: 'Midnight Violet', note: 'Waven’s default' },
  { id: 'dynamic', name: 'Dynamic', note: 'Follows the album playing' },
  { id: 'ocean', name: 'Deep Ocean', note: 'Cool blue' },
  { id: 'ember', name: 'Ember', note: 'Warm amber' },
  { id: 'rose', name: 'Rose Noir', note: 'Plum and rose' },
  { id: 'aurora', name: 'Aurora', note: 'Teal and violet light' },
  { id: 'sunset', name: 'Sunset', note: 'Coral dusk' },
  { id: 'mono', name: 'Studio Mono', note: 'Grayscale, art first' },
];

export const BACKDROP_OPTIONS: readonly { id: Backdrop; name: string }[] = [
  { id: 'solid', name: 'Solid' },
  { id: 'glow', name: 'Soft glow' },
];

type Rgb = [number, number, number];

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

function parseHex(hex: string): Rgb | null {
  const match = HEX_COLOR.exec(hex);
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: string, b: string): number {
  const rgbA = parseHex(a);
  const rgbB = parseHex(b);
  if (!rgbA || !rgbB) {
    return 1;
  }
  const [light, dark] = [luminance(rgbA), luminance(rgbB)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** Chroma in 0–1: how far the color is from gray, whatever its lightness. */
function chroma([r, g, b]: Rgb): number {
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

/** Below this the cover is too close to gray (or black) to tell albums apart. */
const MIN_CHROMA = 0.12;

/** The dark ground the Dynamic theme sits on (Midnight Violet's --bg). */
export const DYNAMIC_BG = '#0b0b10';

/**
 * Turns an album's dominant color into an accent that reads on the dark ground:
 * it is mixed with white until it reaches 4.5:1 (WCAG AA for text). A color too
 * close to gray to tell albums apart gives `null`, and the default violet stays.
 */
export function readableAccent(hex: string | null | undefined, bg = DYNAMIC_BG): string | null {
  const rgb = hex ? parseHex(hex) : null;
  if (!rgb || chroma(rgb) < MIN_CHROMA) {
    return null;
  }
  // First brighten while keeping the hue (the API stores covers darkened), then,
  // if that is not enough, mix with white.
  const maxScale = 255 / Math.max(...rgb);
  for (let scale = 1; scale <= maxScale; scale = Math.min(scale + 0.1, maxScale)) {
    const candidate = toHex(rgb.map((channel) => channel * scale) as Rgb);
    if (contrastRatio(candidate, bg) >= 4.5) {
      return candidate;
    }
    if (scale === maxScale) {
      break;
    }
  }
  const brightest = rgb.map((channel) => channel * maxScale) as Rgb;
  for (let mix = 0.05; mix <= 1; mix += 0.05) {
    const candidate = toHex(brightest.map((channel) => channel + (255 - channel) * mix) as Rgb);
    if (contrastRatio(candidate, bg) >= 4.5) {
      return candidate;
    }
  }
  return null;
}

/** The soft-glow color for an accent: the same hue, faint. */
export function glowFor(accent: string): string {
  const rgb = parseHex(accent);
  return rgb ? `rgb(${rgb.join(' ')} / 26%)` : 'rgb(139 123 255 / 20%)';
}
