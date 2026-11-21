import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { refreshAccessToken } from './client';

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    // No Web Locks: refresh directly.
    vi.stubGlobal('navigator', {});
    useAuthStore.setState({ accessToken: null, status: 'unknown' });
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('stores the new access token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'token-1' }));

    await expect(refreshAccessToken()).resolves.toBe('token-1');
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'token-1',
      status: 'authenticated',
    });
  });

  it('signs the user out when the API rejects the refresh cookie', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { statusCode: 401, code: 'UNAUTHORIZED' }));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('marks the API unreachable on a server error instead of signing out', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('unreachable');
  });

  it('marks the API unreachable on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('unreachable');
  });

  it('keeps a signed-in user signed in when a later refresh cannot reach the API', async () => {
    useAuthStore.setState({ accessToken: 'old', status: 'authenticated' });
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await refreshAccessToken();
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'old', status: 'authenticated' });
  });
});

describe('useAuthStore.retry', () => {
  it('goes back to unknown only from unreachable', () => {
    useAuthStore.setState({ accessToken: null, status: 'unreachable' });
    useAuthStore.getState().retry();
    expect(useAuthStore.getState().status).toBe('unknown');

    useAuthStore.setState({ accessToken: null, status: 'anonymous' });
    useAuthStore.getState().retry();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});
