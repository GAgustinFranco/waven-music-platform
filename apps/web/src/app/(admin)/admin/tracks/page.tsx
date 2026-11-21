import type { Metadata } from 'next';
import { TracksView } from '@/features/admin/tracks-view';

export const metadata: Metadata = { title: 'Tracks' };

export default function AdminTracksPage() {
  return <TracksView />;
}
