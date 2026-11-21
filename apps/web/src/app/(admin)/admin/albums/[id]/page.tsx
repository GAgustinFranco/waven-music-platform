import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingStatus } from '@/components/catalog/states';
import { AlbumEditor } from '@/features/admin/album-editor';

export const metadata: Metadata = { title: 'Album' };

// The id is only known at request time, so the editor reads it under Suspense.
export default function AdminAlbumPage() {
  return (
    <Suspense fallback={<LoadingStatus label="Loading album" />}>
      <AlbumEditor />
    </Suspense>
  );
}
