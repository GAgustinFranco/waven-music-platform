import type { Metadata } from 'next';
import { FavoritesView } from '@/features/library/favorites-view';

export const metadata: Metadata = { title: 'Liked Songs' };

export default function FavoritesPage() {
  return <FavoritesView />;
}
