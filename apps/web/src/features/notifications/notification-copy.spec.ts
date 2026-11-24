import { describe, expect, it } from 'vitest';
import { attentionCount } from '@/lib/api/notifications';
import { describeNotification, describeReminder, formatRelativeTime } from './notification-copy';

describe('notification copy', () => {
  it('links each notification to where it leads', () => {
    expect(describeNotification({ type: 'welcome' })).toMatchObject({
      title: 'Welcome to Waven',
      href: '/',
    });
    expect(describeNotification({ type: 'premium-activated' })).toMatchObject({
      title: "You're on Premium",
      href: '/profile',
    });
  });

  it('tells an unverified account to check its inbox', () => {
    const copy = describeReminder({ type: 'verify-email' }, 'fan@example.com');
    expect(copy.title).toBe('Verify your email');
    expect(copy.body).toContain('fan@example.com');
    expect(copy.href).toBeNull();
  });

  it('counts unread notifications and reminders for the badge', () => {
    expect(attentionCount({ unreadCount: 2, reminders: [{ type: 'verify-email' }] })).toBe(3);
    expect(attentionCount({ unreadCount: 0, reminders: [] })).toBe(0);
  });

  it('formats times relative to now', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    expect(formatRelativeTime('2026-11-24T11:59:30Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-11-24T11:55:00Z', now)).toBe('5 minutes ago');
    expect(formatRelativeTime('2026-11-23T12:00:00Z', now)).toBe('yesterday');
  });
});
