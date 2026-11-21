import type { Metadata } from 'next';
import { DashboardView } from '@/features/admin/dashboard-view';

export const metadata: Metadata = { title: { absolute: 'Admin · Waven' } };

export default function AdminDashboardPage() {
  return <DashboardView />;
}
