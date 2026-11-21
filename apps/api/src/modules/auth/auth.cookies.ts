import { type CookieOptions, type Request, type Response } from 'express';

/** httpOnly refresh token, only sent to the auth routes (through the web proxy). */
export const REFRESH_COOKIE = 'waven_refresh';
export const REFRESH_COOKIE_PATH = '/api/auth';

/** Non-secret indicator the Next.js proxy reads to redirect signed-out visitors. */
export const SESSION_COOKIE = 'waven_session';

/** CSRF state for the Google OAuth round trip. */
export const OAUTH_STATE_COOKIE = 'waven_oauth_state';
export const OAUTH_STATE_COOKIE_PATH = '/api/auth/google';

const baseOptions = (secure: boolean): CookieOptions => ({ sameSite: 'lax', secure });

export function setSessionCookies(
  res: Response,
  refresh: { token: string; expiresAt: Date },
  secure: boolean,
): void {
  res.cookie(REFRESH_COOKIE, refresh.token, {
    ...baseOptions(secure),
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    expires: refresh.expiresAt,
  });
  res.cookie(SESSION_COOKIE, '1', {
    ...baseOptions(secure),
    httpOnly: false,
    path: '/',
    expires: refresh.expiresAt,
  });
}

export function clearSessionCookies(res: Response, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIE, {
    ...baseOptions(secure),
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
  });
  res.clearCookie(SESSION_COOKIE, { ...baseOptions(secure), path: '/' });
}

export function setOAuthStateCookie(res: Response, state: string, secure: boolean): void {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    ...baseOptions(secure),
    httpOnly: true,
    path: OAUTH_STATE_COOKIE_PATH,
    maxAge: 10 * 60_000,
  });
}

export function clearOAuthStateCookie(res: Response, secure: boolean): void {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    ...baseOptions(secure),
    httpOnly: true,
    path: OAUTH_STATE_COOKIE_PATH,
  });
}

export function readCookie(req: Request, name: string): string | undefined {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }
  const value: unknown = (cookies as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
