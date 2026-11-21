import { AA_CONTRAST, contrastRatio, darkenForContrast, TEXT_COLOR, toHex } from './color.js';

describe('color helpers', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
    expect(contrastRatio({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBeCloseTo(1, 5);
  });

  it('keeps a color that already has AA contrast', () => {
    const navy = { r: 20, g: 30, b: 90 };
    expect(darkenForContrast(navy)).toEqual(navy);
  });

  it.each([
    { r: 255, g: 230, b: 0 },
    { r: 250, g: 250, b: 250 },
    { r: 61, g: 217, b: 214 },
  ])('darkens %o until the text reaches AA', (color) => {
    const result = darkenForContrast(color);
    expect(contrastRatio(result, TEXT_COLOR)).toBeGreaterThanOrEqual(AA_CONTRAST);
    expect(result.r).toBeLessThanOrEqual(color.r);
  });

  it('formats hex colors', () => {
    expect(toHex({ r: 11, g: 11, b: 16 })).toBe('#0b0b10');
  });
});
