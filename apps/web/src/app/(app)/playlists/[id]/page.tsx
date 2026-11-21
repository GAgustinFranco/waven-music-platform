import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DominantHeaderSkeleton } from '@/components/catalog/dominant-header';
import { PlaylistView } from '@/features/library/playlist-view';

export const metadata: Metadata = { title: 'Playlist' };

// The id is only known at request time, so the view reads it under Suspense.
export default function PlaylistPage() {
  return (
    <Suspense fallback={<DominantHeaderSkeleton />}>
      <PlaylistView />
    </Suspense>
  );
}
