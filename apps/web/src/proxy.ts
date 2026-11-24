import { type NextRequest, NextResponse } from 'next/server';

/**
 * Optimistic redirects only. `waven_session` is a non-secret indicator set next to
 * the httpOnly refresh cookie; the API stays the source of truth.
 */
const SESSION_COOKIE = 'waven_session';
const PUBLIC_PATHS = new Set(['/login']);
/** Open with or without a session: the email link may be opened on any device. */
const OPEN_PATHS = new Set(['/verify-email']);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN_PATHS.has(pathname)) {
    return NextResponse.next();
  }
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the API proxy, Next internals and metadata files.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
