import { parseRange } from './range.js';

describe('parseRange', () => {
  const size = 1000;

  it.each([
    ['bytes=0-99', { start: 0, end: 99 }],
    ['bytes=500-', { start: 500, end: 999 }],
    ['bytes=-100', { start: 900, end: 999 }],
    ['bytes=-5000', { start: 0, end: 999 }],
    ['bytes=990-2000', { start: 990, end: 999 }],
    [' bytes=0-0 ', { start: 0, end: 0 }],
  ])('%s → partial %o', (header, range) => {
    expect(parseRange(header, size)).toEqual({ kind: 'partial', range });
  });

  it.each(['bytes=1000-', 'bytes=1500-1600', 'bytes=-0'])('%s is unsatisfiable', (header) => {
    expect(parseRange(header, size)).toEqual({ kind: 'unsatisfiable' });
  });

  it.each([undefined, '', 'items=0-10', 'bytes=0-10,20-30', 'bytes=-', 'bytes=50-10', 'bytes=a-b'])(
    '%j falls back to the full body',
    (header) => {
      expect(parseRange(header, size)).toEqual({ kind: 'full' });
    },
  );
});
