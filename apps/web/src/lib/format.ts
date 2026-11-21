/** Track length as `m:ss` (or `h:mm:ss` past an hour), for Geist Mono columns. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** Album length in words, e.g. `42 min` or `1 hr 5 min`. */
export function formatTotalDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

/** Spoken form of a duration for screen readers, e.g. `3 minutes 5 seconds`. */
export function describeDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    minutes > 0 ? `${minutes} minute${minutes === 1 ? '' : 's'}` : null,
    seconds > 0 || minutes === 0 ? `${seconds} second${seconds === 1 ? '' : 's'}` : null,
  ];
  return parts.filter(Boolean).join(' ');
}

/** Year from an ISO `YYYY-MM-DD` date, or null. */
export function releaseYear(date: string | null): string | null {
  const year = date?.slice(0, 4);
  return year && /^\d{4}$/.test(year) ? year : null;
}

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

/** Up to two initials for an avatar fallback ("Ada Lovelace" → "AL"). */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });

/** "November 2026" from an ISO timestamp, or null if it does not parse. */
export function formatMonthYear(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : MONTH_YEAR.format(date);
}
