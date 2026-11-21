import type { Metadata } from 'next';
import { ComingSoon } from '@/components/layout/coming-soon';

export const metadata: Metadata = { title: 'Premium' };

export default function PremiumPage() {
  return <ComingSoon title="Premium" description="Higher-quality audio and unlimited playlists." />;
}
