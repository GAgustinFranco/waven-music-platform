'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import type { ComponentProps, FocusEvent, PointerEvent } from 'react';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { prefetchForHref } from '@/lib/api/prefetch';

/**
 * A `next/link` that also warms the TanStack Query cache for album, artist and
 * playlist pages on hover or keyboard focus, so the page opens with its data.
 * Next already prefetches the route code; this covers the client-side data.
 */
export function PrefetchLink({ onPointerEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const queryClient = useQueryClient();
  const ready = useSessionReady();
  const href = typeof props.href === 'string' ? props.href : null;

  const warm = () => {
    const prefetch = ready && href ? prefetchForHref(href) : null;
    // A failed prefetch is not an error: the page fetches (and reports) on its own.
    void prefetch?.(queryClient);
  };

  return (
    <Link
      {...props}
      onPointerEnter={(event: PointerEvent<HTMLAnchorElement>) => {
        // Touch fires pointerenter right before the click; prefetching then is useless.
        if (event.pointerType !== 'touch') {
          warm();
        }
        onPointerEnter?.(event);
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        warm();
        onFocus?.(event);
      }}
    />
  );
}
