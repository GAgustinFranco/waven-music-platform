export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `--text` from the design tokens: headers put it on top of the dominant color. */
export const TEXT_COLOR: Rgb = { r: 0xf4, g: 0xf4, b: 0xf8 };
/** WCAG AA for normal text. */
export const AA_CONTRAST = 4.5;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** Scales the color towards black until `TEXT_COLOR` on top of it reaches AA. */
export function darkenForContrast(color: Rgb, minContrast = AA_CONTRAST): Rgb {
  let current = color;
  for (let factor = 1; factor > 0; factor -= 0.02) {
    current = {
      r: Math.round(color.r * factor),
      g: Math.round(color.g * factor),
      b: Math.round(color.b * factor),
    };
    if (contrastRatio(current, TEXT_COLOR) >= minContrast) {
      return current;
    }
  }
  return { r: 0, g: 0, b: 0 };
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
