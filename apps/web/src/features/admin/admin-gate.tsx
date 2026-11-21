'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect } from 'react';
import { ErrorState, LoadingStatus } from '@/components/catalog/states';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { meQuery } from '@/lib/api/queries';
import { useAuthStore } from '@/stores/auth.store';

const AdminAccess = createContext(false);

/** Admin queries wait for this: the session is restored and the user is an admin. */
export const useAdminReady = () => useContext(AdminAccess);

/**
 * Client-side guard for `/admin`: anyone who is not an admin is sent home. It is a
 * convenience only; every `/admin/*` endpoint enforces the role on the API.
 *
 * The pages always render (hidden), so their static shells are prerendered, but
 * they fetch nothing until `useAdminReady()` is true.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const ready = useSessionReady();
  const status = useAuthStore((state) => state.status);
  const retry = useAuthStore((state) => state.retry);
  const me = useQuery({ ...meQuery(), enabled: ready });
  const router = useRouter();
  const isAdmin = ready && me.data?.role === 'admin';
  const denied = me.isSuccess && me.data.role !== 'admin';

  useEffect(() => {
    if (denied) {
      router.replace('/');
    }
  }, [denied, router]);

  let fallback: ReactNode = null;
  if (status === 'unreachable') {
    fallback = <ErrorState as="h1" title="We can't reach Waven right now" onRetry={retry} />;
  } else if (me.isError) {
    fallback = (
      <ErrorState
        as="h1"
        title="We couldn't check your access"
        onRetry={() => void me.refetch()}
        retrying={me.isFetching}
      />
    );
  } else if (!isAdmin) {
    fallback = (
      <div className="flex flex-col gap-4">
        <LoadingStatus label={denied ? 'Redirecting' : 'Checking access'} />
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AdminAccess.Provider value={isAdmin}>
      {fallback}
      <div hidden={!isAdmin} inert={!isAdmin}>
        {children}
      </div>
    </AdminAccess.Provider>
  );
}
