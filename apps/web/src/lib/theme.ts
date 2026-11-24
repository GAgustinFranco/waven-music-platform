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
