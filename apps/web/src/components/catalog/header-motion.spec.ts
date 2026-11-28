import { describe, expect, it } from 'vitest';
import { BAR_SHOWN_AT, glarePosition, HEADER_MOTION, isBarShown } from './header-motion';

describe('HEADER_MOTION', () => {
  it('fades the text out before the compact bar starts to appear', () => {
    expect(HEADER_MOTION.textOpacity.range[1]).toBeLessThanOrEqual(
      HEADER_MOTION.barOpacity.range[0],
    );
  });

  it('keeps every range inside the header scroll progress', () => {
    for (const { range } of Object.values(HEADER_MOTION)) {
      expect(range[0]).toBeGreaterThanOrEqual(0);
      expect(range[1]).toBeLessThanOrEqual(1);
      expect(range[0]).toBeLessThan(range[1]);
    }
  });

  it('only shrinks the cover, never past 80 %', () => {
    expect(HEADER_MOTION.coverScale.output).toEqual([1, 0.8]);
  });
});

describe('isBarShown', () => {
  it('hides the bar at rest and shows it once it starts fading in', () => {
    expect(isBarShown(0)).toBe(false);
    expect(isBarShown(BAR_SHOWN_AT)).toBe(false);
    expect(isBarShown(BAR_SHOWN_AT + 0.01)).toBe(true);
    expect(isBarShown(1)).toBe(true);
  });
});

describe('glarePosition', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };

  it('maps the pointer to percentages of the header', () => {
    expect(glarePosition(300, 150, rect)).toEqual({ x: '50.0%', y: '50.0%' });
    expect(glarePosition(100, 50, rect)).toEqual({ x: '0.0%', y: '0.0%' });
  });

  it('clamps positions outside the header', () => {
    expect(glarePosition(0, 1000, rect)).toEqual({ x: '0.0%', y: '100.0%' });
  });

  it('centers the light on an empty box', () => {
    expect(glarePosition(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: '50.0%',
      y: '50.0%',
    });
  });
});
