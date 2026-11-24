import { describe, expect, it } from 'vitest';
import { contrastRatio, THEME_OPTIONS } from './theme';

describe('contrastRatio', () => {
  it('matches the WCAG formula at the extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
  });

  it('treats an invalid color as no contrast', () => {
    expect(contrastRatio('red', '#ffffff')).toBe(1);
  });
});

describe('THEME_OPTIONS', () => {
  it('lists Waven’s default first and every theme once', () => {
    expect(THEME_OPTIONS[0]?.id).toBe('violet');
    expect(new Set(THEME_OPTIONS.map((option) => option.id)).size).toBe(8);
  });
});
