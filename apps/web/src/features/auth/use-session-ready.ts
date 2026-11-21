import { useAuthStore } from '@/stores/auth.store';

/** Authenticated queries wait for the session to be restored (the token lives in memory). */
export const useSessionReady = () => useAuthStore((state) => state.status === 'authenticated');
