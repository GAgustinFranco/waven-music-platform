import { infiniteQueryOptions } from '@tanstack/react-query';
import { api } from './client';
import { toApiError } from './queries';
import type { components } from './schema';

type Schemas = components['schemas'];
export type AppNotification = Schemas['NotificationDto'];
export type NotificationType = AppNotification['type'];
export type Reminder = Schemas['ReminderDto'];
export type NotificationsPage = Schemas['NotificationsPageDto'];

const PAGE_SIZE = 20;
/** Light polling while the app is open; a focus refetch covers coming back to the tab. */
export const NOTIFICATIONS_POLL_MS = 60_000;

/** Query key factories for notifications (every notifications key is built here). */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
};

/** Newest first; the unread count and reminders come with every page. */
export const notificationsQuery = () =>
  infiniteQueryOptions({
    queryKey: notificationKeys.list(),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<NotificationsPage> => {
      const { data, error, response } = await api.GET('/notifications', {
        params: { query: { limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) } },
      });
      if (!data) {
        throw toApiError(error, response);
      }
      return data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchOnWindowFocus: true,
  });

/** What the bell's badge counts: unread notifications plus active reminders. */
export function attentionCount(page: Pick<NotificationsPage, 'unreadCount' | 'reminders'>): number {
  return page.unreadCount + page.reminders.length;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const { data, error, response } = await api.PATCH('/notifications/{id}/read', {
    params: { path: { id } },
  });
  if (!data) {
    throw toApiError(error, response);
  }
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error, response } = await api.POST('/notifications/read-all');
  if (!response.ok) {
    throw toApiError(error, response);
  }
}
