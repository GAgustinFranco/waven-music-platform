import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchView } from '@/features/search/search-view';

export const metadata: Metadata = { title: 'Search' };

// The view reads `?q=&type=`, so it renders on the client under Suspense.
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchView />
    </Suspense>
  );
}

/** Same footprint as the search box and filters, so nothing shifts when they mount. */
function SearchFallback() {
  return (
    <div aria-hidden="true" className="px-gutter lg:px-gutter-lg flex flex-col gap-4 pt-20">
      <Skeleton className="h-12 w-full max-w-xl rounded-full" />
      <Skeleton className="h-8 w-64 rounded-full" />
    </div>
  );
}
