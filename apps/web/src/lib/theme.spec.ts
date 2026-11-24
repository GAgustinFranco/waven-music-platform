import { describe, expect, it } from 'vitest';
import { contrastRatio, DYNAMIC_BG, glowFor, readableAccent, THEME_OPTIONS } from './theme';

describe('readableAccent', () => {
  it('keeps a color that already reads on the dark ground', () => {
    expect(readableAccent('#ff6f9c')).toBe('#ff6f9c');
  });

  it('lightens a dark album color until it reaches 4.5:1', () => {
    const accent = readableAccent('#3a2f6b');
    expect(accent).not.toBeNull();
    expect(accent).not.toBe('#3a2f6b');
    expect(contrastRatio(accent ?? '', DYNAMIC_BG)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['#808080'],
    ['#1a1a1c'],
    ['#1a1a22'],
    ['#26262f'],
    [null],
    [undefined],
    ['red'],
    ['#fff'],
  ])('falls back to the default for %s', (color) => {
    expect(readableAccent(color)).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG formula at the extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
  });
});

describe('glowFor', () => {
  it('turns an accent into a faint light of the same hue', () => {
    expect(glowFor('#ff6f9c')).toBe('rgb(255 111 156 / 26%)');
  });
});

describe('THEME_OPTIONS', () => {
  it('lists Waven’s default first and every theme once', () => {
    expect(THEME_OPTIONS[0]?.id).toBe('violet');
    expect(new Set(THEME_OPTIONS.map((option) => option.id)).size).toBe(8);
  });
});
