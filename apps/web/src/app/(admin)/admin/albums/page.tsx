import type { Metadata } from 'next';
import { AlbumsView } from '@/features/admin/albums-view';

export const metadata: Metadata = { title: 'Albums' };

export default function AdminAlbumsPage() {
  return <AlbumsView />;
}
