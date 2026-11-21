import { describe, expect, it } from 'vitest';
import { dominantColorStyle } from './dominant-color';

describe('dominantColorStyle', () => {
  it('exposes a hex color as the --dominant-color variable', () => {
    expect(dominantColorStyle('#3a2f6b')).toEqual({ '--dominant-color': '#3a2f6b' });
  });

  it('falls back to the token default when the color is missing', () => {
    expect(dominantColorStyle(null)).toBeUndefined();
    expect(dominantColorStyle(undefined)).toBeUndefined();
  });

  it('drops anything that is not a plain hex color', () => {
    expect(dominantColorStyle('red; background: url(x)')).toBeUndefined();
    expect(dominantColorStyle('#fff')).toBeUndefined();
  });
});
