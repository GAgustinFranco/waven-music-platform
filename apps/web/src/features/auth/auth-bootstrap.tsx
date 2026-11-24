'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { refreshAccessToken } from '@/lib/api/client';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Restores the session on load (the access token only lives in memory) and sends
 * the visitor to /login once the API says there is no session.
 */
export function AuthBootstrap() {
  const status = useAuthStore((state) => state.status);
  const pathname = usePathname();
  const router = useRouter();
  // /verify-email works without a session, so it never sends anyone to /login.
  const onPublicPage = pathname === '/login' || pathname === '/verify-email';

  useEffect(() => {
    if (status === 'unknown' && !onPublicPage) {
      void refreshAccessToken();
    }
  }, [status, onPublicPage]);

  useEffect(() => {
    if (status === 'anonymous' && !onPublicPage) {
      router.replace('/login');
    }
  }, [status, onPublicPage, router]);

  return null;
}
