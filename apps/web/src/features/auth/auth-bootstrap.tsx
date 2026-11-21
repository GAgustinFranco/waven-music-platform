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
  const onLoginPage = pathname === '/login';

  useEffect(() => {
    if (status === 'unknown' && !onLoginPage) {
      void refreshAccessToken();
    }
  }, [status, onLoginPage]);

  useEffect(() => {
    if (status === 'anonymous' && !onLoginPage) {
      router.replace('/login');
    }
  }, [status, onLoginPage, router]);

  return null;
}
