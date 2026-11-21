import { describe, expect, it } from 'vitest';
import {
  describeDuration,
  formatDuration,
  formatMonthYear,
  formatTotalDuration,
  initialsOf,
  pluralize,
  releaseYear,
} from './format';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [5_000, '0:05'],
    [185_400, '3:05'],
    [599_600, '10:00'],
    [3_723_000, '1:02:03'],
    [-1_000, '0:00'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('formatTotalDuration', () => {
  it.each([
    [0, '0 min'],
    [2_520_000, '42 min'],
    [3_600_000, '1 hr'],
    [3_900_000, '1 hr 5 min'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatTotalDuration(ms)).toBe(expected);
  });
});

describe('describeDuration', () => {
  it('spells out minutes and seconds with plurals', () => {
    expect(describeDuration(185_000)).toBe('3 minutes 5 seconds');
    expect(describeDuration(61_000)).toBe('1 minute 1 second');
    expect(describeDuration(120_000)).toBe('2 minutes');
    expect(describeDuration(0)).toBe('0 seconds');
  });
});

describe('releaseYear', () => {
  it('extracts the year from an ISO date', () => {
    expect(releaseYear('2021-06-30')).toBe('2021');
  });

  it('returns null for missing or malformed dates', () => {
    expect(releaseYear(null)).toBeNull();
    expect(releaseYear('soon')).toBeNull();
  });
});

describe('pluralize', () => {
  it('picks the singular only for one', () => {
    expect(pluralize(1, 'track')).toBe('1 track');
    expect(pluralize(0, 'track')).toBe('0 tracks');
    expect(pluralize(12, 'album')).toBe('12 albums');
  });
});

describe('initialsOf', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['  grace   brewster murray hopper ', 'GB'],
    ['Prince', 'P'],
    ['', ''],
  ])('%j → %j', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe('formatMonthYear', () => {
  it('formats a timestamp as month and year', () => {
    expect(formatMonthYear('2026-11-15T12:00:00.000Z')).toBe('November 2026');
  });

  it('returns null for an invalid timestamp', () => {
    expect(formatMonthYear('not a date')).toBeNull();
  });
});
