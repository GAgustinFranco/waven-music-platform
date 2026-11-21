import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DominantHeaderSkeleton } from '@/components/catalog/dominant-header';
import { AlbumView } from '@/features/catalog/album-view';

export const metadata: Metadata = { title: 'Album' };

// The id is only known at request time, so the view reads it under Suspense.
export default function AlbumPage() {
  return (
    <Suspense fallback={<DominantHeaderSkeleton />}>
      <AlbumView />
    </Suspense>
  );
}
