import type { HistoryEntry } from '@/lib/api/history';

export interface DayGroup {
  /** `YYYY-MM-DD` in local time; stable across renders. */
  key: string;
  label: string;
  /** Index of the first entry in the whole list. */
  start: number;
  entries: HistoryEntry[];
}

const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** "Today", "Yesterday", or the date (with the year only when it is not this year). */
export function dayLabel(date: Date, now: Date): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (localDay(date) === localDay(now)) {
    return 'Today';
  }
  if (localDay(date) === localDay(yesterday)) {
    return 'Yesterday';
  }
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

/**
 * Splits newest-first entries into consecutive local days, keeping their order.
 * The clock is only read when there are entries: never during the prerender.
 */
export function groupByDay(entries: readonly HistoryEntry[], clock?: Date): DayGroup[] {
  if (entries.length === 0) {
    return [];
  }
  const now = clock ?? new Date();
  const groups: DayGroup[] = [];
  for (const [index, entry] of entries.entries()) {
    const date = new Date(entry.playedAt);
    const key = localDay(date);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, label: dayLabel(date, now), start: index, entries: [entry] });
    }
  }
  return groups;
}
