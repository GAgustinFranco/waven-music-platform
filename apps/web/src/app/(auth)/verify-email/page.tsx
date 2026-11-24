import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmailView } from '@/features/auth/verify-email-view';

export const metadata: Metadata = {
  title: 'Verify your email',
  // The token is in the URL: never send it to other sites.
  referrer: 'no-referrer',
  robots: { index: false },
};

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
