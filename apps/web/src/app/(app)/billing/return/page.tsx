import type { Metadata } from 'next';
import { BillingReturnView } from '@/features/billing/billing-return-view';

export const metadata: Metadata = { title: 'Payment' };

export default function BillingReturnPage() {
  return <BillingReturnView />;
}
