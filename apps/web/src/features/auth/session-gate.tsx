'use client';

import type { ReactNode } from 'react';
import { ErrorState } from '@/components/catalog/states';
import { useAuthStore } from '@/stores/auth.store';

/** Shows a retryable error instead of endless skeletons when the API cannot be reached. */
export function SessionGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const retry = useAuthStore((state) => state.retry);

  if (status === 'unreachable') {
    return (
      <div className="px-gutter lg:px-gutter-lg pt-20">
        <ErrorState as="h1" title="We can't reach Waven right now" onRetry={retry} />
      </div>
    );
  }

  return children;
}
