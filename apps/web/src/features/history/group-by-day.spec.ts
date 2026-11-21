import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@/lib/api/history';
import { dayLabel, groupByDay } from './group-by-day';

const now = new Date(2026, 10, 21, 15, 0);
const at = (id: string, date: Date) => ({ id, playedAt: date.toISOString() }) as HistoryEntry;

describe('dayLabel', () => {
  it('names today and yesterday', () => {
    expect(dayLabel(new Date(2026, 10, 21, 0, 5), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 20, 23, 59), now)).toBe('Yesterday');
  });

  it('shows the date, with the year only for other years', () => {
    expect(dayLabel(new Date(2026, 10, 2), now)).toBe('Monday, November 2');
    expect(dayLabel(new Date(2025, 11, 31), now)).toBe('Wednesday, December 31, 2025');
  });
});

describe('groupByDay', () => {
  it('keeps the order and splits on local day changes', () => {
    const groups = groupByDay(
      [
        at('a', new Date(2026, 10, 21, 14)),
        at('b', new Date(2026, 10, 21, 9)),
        at('c', new Date(2026, 10, 20, 22)),
        at('d', new Date(2026, 10, 2, 8)),
      ],
      now,
    );

    expect(groups.map((group) => [group.label, group.entries.map((entry) => entry.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['Monday, November 2', ['d']],
    ]);
    expect(groups.map((group) => group.start)).toEqual([0, 2, 3]);
  });

  it('returns no groups for no entries', () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
