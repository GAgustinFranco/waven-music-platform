/** The part of `Storage` the activation check needs (a fake in tests). */
export type ActivationStore = Pick<Storage, 'getItem' | 'setItem'>;

export const activationKey = (subscriptionId: string) =>
  `waven:premium-activation:${subscriptionId}`;

/**
 * Whether this is the first time this browser sees the activation of
 * `subscriptionId`, recording it so later visits and reloads skip the
 * celebration. When storage is unavailable it plays (once per mount).
 */
export function claimActivation(store: ActivationStore, subscriptionId: string): boolean {
  const key = activationKey(subscriptionId);
  try {
    if (store.getItem(key) !== null) {
      return false;
    }
    store.setItem(key, new Date().toISOString());
  } catch {
    // Private mode or a full quota: celebrating twice beats never.
  }
  return true;
}
