import type { Metadata } from 'next';
import { ArtistsView } from '@/features/admin/artists-view';

export const metadata: Metadata = { title: 'Artists' };

export default function AdminArtistsPage() {
  return <ArtistsView />;
}
