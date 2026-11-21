import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * `false` on the server and while hydrating, `true` afterwards. Components
 * outside the session gate that render cached client data (which the server
 * never has) use it to hydrate the same markup the server sent first.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
