'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Gem, MailWarning, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, type ReactNode, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSessionReady } from '@/features/auth/use-session-ready';
import {
  type AppNotification,
  attentionCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  notificationsQuery,
  type NotificationType,
} from '@/lib/api/notifications';
import { meQuery } from '@/lib/api/queries';
import { cn } from 'cn';
import { describeNotification, describeReminder, formatRelativeTime } from './notification-copy';

const ICONS: Record<NotificationType, typeof Bell> = {
  welcome: PartyPopper,
  'premium-activated': Gem,
};

/**
 * The header's bell: a badge with what needs attention and a popover with the
 * notifications. Opening it marks nothing; a notification is read when it is
 * clicked, or all at once with "Mark all as read" (docs/SPEC.md, Assumptions).
 */
export function NotificationBell() {
  const ready = useSessionReady();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const headingId = useId();
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({ ...notificationsQuery(), enabled: ready });
  const { data: me } = useQuery({ ...meQuery(), enabled: ready });

  const firstPage = query.data?.pages[0];
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const reminders = firstPage?.reminders ?? [];
  const unread = firstPage?.unreadCount ?? 0;
  const count = firstPage ? attentionCount(firstPage) : 0;

  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const markRead = useMutation({ mutationFn: markNotificationRead, onSettled: refresh });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSettled: refresh });

  if (!ready) {
    return null;
  }

  const label =
    count > 0 ? `Notifications, ${count} need${count === 1 ? 's' : ''} attention` : 'Notifications';

  function openNotification(notification: AppNotification) {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    setOpen(false);
  }

  /**
   * Closing the popover unmounts the link, which drops the Link's own navigation,
   * so a plain click navigates through the router. Modified clicks (new tab or
   * window) keep the browser's default.
   */
  function followLink(
    event: MouseEvent<HTMLAnchorElement>,
    notification: AppNotification,
    href: string,
  ) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    router.push(href);
    openNotification(notification);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className="data-[state=open]:bg-elevated relative rounded-full"
        >
          <Bell aria-hidden="true" className="size-5" />
          {count > 0 ? (
            <span
              aria-hidden="true"
              className="bg-brand text-primary-foreground ring-background absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold ring-2"
            >
              {count > 9 ? '9+' : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        aria-labelledby={headingId}
        className="flex max-h-[min(32rem,calc(100dvh-6rem))] w-[min(22rem,calc(100vw-2rem))] flex-col p-0"
      >
        <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 id={headingId} className="text-sm font-semibold">
            Notifications
          </h2>
          <Button
            variant="ghost"
            size="sm"
            // aria-disabled instead of disabled: the button keeps focus once it has done its job.
            aria-disabled={unread === 0 || markAll.isPending}
            className="aria-disabled:text-muted-foreground aria-disabled:cursor-default aria-disabled:hover:bg-transparent"
            onClick={() => {
              if (unread > 0 && !markAll.isPending) {
                markAll.mutate();
              }
            }}
          >
            Mark all as read
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.isPending ? (
            <p role="status" className="text-muted-foreground px-4 py-6 text-center">
              Loading notifications…
            </p>
          ) : query.isError ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <p role="alert" className="text-muted-foreground">
                Notifications could not be loaded.
              </p>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </div>
          ) : reminders.length === 0 && items.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-center">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="flex flex-col py-1">
              {reminders.map((reminder) => {
                const copy = describeReminder(reminder, me?.email ?? null);
                return (
                  <li key={reminder.type}>
                    <Row icon={MailWarning} title={copy.title} body={copy.body} highlighted />
                  </li>
                );
              })}
              {items.map((notification) => {
                const copy = describeNotification(notification);
                const { href } = copy;
                const row = (
                  <Row
                    icon={ICONS[notification.type]}
                    title={copy.title}
                    body={copy.body}
                    time={formatRelativeTime(notification.createdAt)}
                    highlighted={!notification.readAt}
                  />
                );
                return (
                  <li key={notification.id}>
                    {href ? (
                      <Link
                        href={href}
                        onClick={(event) => followLink(event, notification, href)}
                        className="hover:bg-elevated focus-visible:bg-elevated focus-visible:ring-ring block outline-none focus-visible:ring-2 focus-visible:ring-inset"
                      >
                        {row}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="hover:bg-elevated focus-visible:bg-elevated focus-visible:ring-ring block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
                      >
                        {row}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {query.hasNextPage ? (
          <div className="border-border border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Show older'}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function Row({
  icon: Icon,
  title,
  body,
  time,
  highlighted,
}: {
  icon: typeof Bell;
  title: string;
  body: string;
  time?: string;
  highlighted: boolean;
}): ReactNode {
  return (
    <div className="flex gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          highlighted ? 'bg-brand/15 text-brand' : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{title}</span>
          {highlighted && time ? (
            <span className="bg-brand size-2 shrink-0 rounded-full">
              <span className="sr-only">Unread</span>
            </span>
          ) : null}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">{body}</p>
        {time ? <p className="text-muted-foreground text-xs">{time}</p> : null}
      </div>
    </div>
  );
}
