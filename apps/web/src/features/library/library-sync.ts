import type { QueryClient, QueryKey } from '@tanstack/react-query';

const CHANNEL = 'waven-library';

interface LibraryMessage {
  invalidate: QueryKey;
}

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  }
  return channel;
}

/**
 * Tells the other open tabs that this server state changed, so they refetch it
 * instead of showing (and reordering from) a stale copy.
 */
export function broadcastLibraryChange(queryKey: QueryKey): void {
  getChannel()?.postMessage({ invalidate: queryKey } satisfies LibraryMessage);
}

/** Invalidates whatever another tab reports as changed. Returns the unsubscribe function. */
export function listenToLibraryChanges(queryClient: QueryClient): () => void {
  const current = getChannel();
  if (!current) {
    return () => undefined;
  }
  const onMessage = (event: MessageEvent<LibraryMessage>) => {
    if (Array.isArray(event.data?.invalidate)) {
      void queryClient.invalidateQueries({ queryKey: event.data.invalidate });
    }
  };
  current.addEventListener('message', onMessage);
  return () => current.removeEventListener('message', onMessage);
}
