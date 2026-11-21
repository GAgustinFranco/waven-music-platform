import type { Metadata } from 'next';
import { QueueView } from '@/features/player/queue-view';

export const metadata: Metadata = { title: 'Queue' };

export default function QueuePage() {
  return <QueueView />;
}
