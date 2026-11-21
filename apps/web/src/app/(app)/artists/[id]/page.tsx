import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DominantHeaderSkeleton } from '@/components/catalog/dominant-header';
import { ArtistView } from '@/features/catalog/artist-view';

export const metadata: Metadata = { title: 'Artist' };

// The id is only known at request time, so the view reads it under Suspense.
export default function ArtistPage() {
  return (
    <Suspense fallback={<DominantHeaderSkeleton shape="round" />}>
      <ArtistView />
    </Suspense>
  );
}
