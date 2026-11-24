import type { AppNotification, Reminder } from '@/lib/api/notifications';

/** What a notification says. The API sends only the type and data; the copy lives here. */
export interface NotificationCopy {
  title: string;
  body: string;
  /** Where clicking the notification goes; null when there is nothing to open. */
  href: string | null;
}

export function describeNotification(
  notification: Pick<AppNotification, 'type'>,
): NotificationCopy {
  switch (notification.type) {
    case 'welcome':
      return {
        title: 'Welcome to Waven',
        body: 'Your library starts here. Find something to play on Home.',
        href: '/',
      };
    case 'premium-activated':
      return {
        title: "You're on Premium",
        body: 'Unlimited playlists and every theme are yours. See your plan in your profile.',
        href: '/profile',
      };
  }
}

export function describeReminder(reminder: Reminder, email: string | null): NotificationCopy {
  switch (reminder.type) {
    case 'verify-email':
      return {
        title: 'Verify your email',
        body: `We sent a link to ${email ?? 'your inbox'}. Open it to confirm your address, and check your spam folder if it is not there.`,
        href: null,
      };
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "5 minutes ago", "yesterday"… */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.trunc(seconds / size), unit);
    }
  }
  return 'just now';
}
