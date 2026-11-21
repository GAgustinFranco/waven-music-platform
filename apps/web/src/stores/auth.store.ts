import { create } from 'zustand';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  /** Short-lived access JWT. Lives in memory only, never in storage. */
  accessToken: string | null;
  status: AuthStatus;
  setAccessToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  status: 'unknown',
  setAccessToken: (accessToken) => set({ accessToken, status: 'authenticated' }),
  clear: () => set({ accessToken: null, status: 'anonymous' }),
}));
