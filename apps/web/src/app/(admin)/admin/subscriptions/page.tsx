import type { Metadata } from 'next';
import { SubscriptionsView } from '@/features/admin/users-view';

export const metadata: Metadata = { title: 'Subscriptions' };

export default function AdminSubscriptionsPage() {
  return <SubscriptionsView />;
}
