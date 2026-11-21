import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata: Metadata = { title: 'Library' };

export default function LibraryPage() {
  return (
    <ComingSoon title="Library" description="Your playlists and favorite tracks will live here." />
  );
}
