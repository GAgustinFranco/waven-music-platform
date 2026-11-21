import type { Metadata } from 'next';
import { HistoryView } from '@/features/history/history-view';

export const metadata: Metadata = { title: 'Listening history' };

export default function HistoryPage() {
  return <HistoryView />;
}
