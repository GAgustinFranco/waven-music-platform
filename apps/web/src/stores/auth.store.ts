import { create } from 'zustand';

/**
 * - `unknown`: restoring the session on load.
 * - `unreachable`: the session could not be restored because the API is down or
 *   unreachable (network error or 5xx); the user may still have a valid session.
 */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous' | 'unreachable';

interface AuthState {
  /** Short-lived access JWT. Lives in memory only, never in storage. */
  accessToken: string | null;
  status: AuthStatus;
  setAccessToken: (token: string) => void;
  clear: () => void;
  /** Only while restoring the session: a signed-in user keeps their state. */
  markUnreachable: () => void;
  /** Back to `unknown`, which makes the bootstrap try to restore the session again. */
  retry: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  status: 'unknown',
  setAccessToken: (accessToken) => set({ accessToken, status: 'authenticated' }),
  clear: () => set({ accessToken: null, status: 'anonymous' }),
  markUnreachable: () =>
    set((state) => (state.status === 'unknown' ? { status: 'unreachable' } : state)),
  retry: () => set((state) => (state.status === 'unreachable' ? { status: 'unknown' } : state)),
}));
