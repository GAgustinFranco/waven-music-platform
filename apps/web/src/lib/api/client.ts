import createClient, { type Middleware } from 'openapi-fetch';
import { useAuthStore } from '@/stores/auth.store';
import type { components, paths } from './schema';

export type Me = components['schemas']['MeDto'];
export type AccessToken = components['schemas']['AccessTokenDto'];

/** Every request goes through the Next.js `/api` rewrite, so cookies stay first-party. */
export const API_BASE_URL = '/api';

/** The API rejects cookie-authenticated calls without it (CSRF defense). */
export const CSRF_HEADERS = { 'X-Requested-With': 'fetch' };

let refreshInFlight: Promise<string | null> | null = null;

/** Serializes refreshes across tabs, which share the cookie jar. */
function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return task();
  }
  return navigator.locks.request('waven-refresh', task);
}

/**
 * Trades the httpOnly refresh cookie for a new access token. The API rotates the
 * cookie on every call and treats a replayed token as theft, so parallel refreshes
 * must never send the same cookie: callers in this tab share one request, and
 * tabs take turns through a Web Lock (the next one sends the rotated cookie).
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await withCrossTabLock(() =>
        fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: CSRF_HEADERS,
          credentials: 'same-origin',
        }),
      );
      if (response.status >= 500) {
        // The API (or the proxy in front of it) is down: the session may still be valid.
        useAuthStore.getState().markUnreachable();
        return null;
      }
      if (!response.ok) {
        useAuthStore.getState().clear();
        return null;
      }
      const { accessToken } = (await response.json()) as AccessToken;
      useAuthStore.getState().setAccessToken(accessToken);
      return accessToken;
    } catch {
      // Network error: a signed-in user keeps their state; a restore is marked unreachable.
      useAuthStore.getState().markUnreachable();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: CSRF_HEADERS,
      credentials: 'same-origin',
    });
  } finally {
    useAuthStore.getState().clear();
  }
}

const isAuthRoute = (schemaPath: string) => schemaPath.startsWith('/auth/');

// Copies of outgoing requests, so a request can be replayed after a refresh.
const pendingRetries = new Map<string, Request>();

/** Adds the Bearer token, and on a 401 refreshes once and replays the request. */
const authMiddleware: Middleware = {
  onRequest({ request, schemaPath, id }) {
    if (isAuthRoute(schemaPath)) {
      return request;
    }
    const token = useAuthStore.getState().accessToken;
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    pendingRetries.set(id, request.clone());
    return request;
  },
  async onResponse({ response, schemaPath, id }) {
    const original = pendingRetries.get(id);
    pendingRetries.delete(id);
    if (response.status !== 401 || !original || isAuthRoute(schemaPath)) {
      return response;
    }

    const token = await refreshAccessToken();
    if (!token) {
      return response;
    }
    const retry = new Request(original);
    retry.headers.set('Authorization', `Bearer ${token}`);
    return fetch(retry);
  },
  onError({ id }) {
    pendingRetries.delete(id);
  },
};

export const api = createClient<paths>({ baseUrl: API_BASE_URL, credentials: 'same-origin' });
api.use(authMiddleware);
