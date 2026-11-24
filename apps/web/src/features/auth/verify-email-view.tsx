'use client';

import { useMutation } from '@tanstack/react-query';
import { CircleCheck, CircleX, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { verifyEmail } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/queries';
import { EqualizerMark } from './equalizer-mark';

type Outcome = 'verifying' | 'verified' | 'invalid' | 'failed';

/**
 * Target of the link in the welcome email. The page posts the token instead of
 * the link doing a GET, so mail scanners that open links can't use it up.
 */
export function VerifyEmailView() {
  const params = useSearchParams();
  // Read once: the token is then dropped from the address bar and the history.
  const [token] = useState(() => params.get('token'));
  const started = useRef(false);
  const verify = useMutation({ mutationFn: verifyEmail });
  const { mutate } = verify;

  useEffect(() => {
    if (started.current || !token) {
      return;
    }
    started.current = true;
    window.history.replaceState(null, '', '/verify-email');
    mutate(token);
  }, [token, mutate]);

  const outcome: Outcome = !token
    ? 'invalid'
    : verify.isSuccess
      ? 'verified'
      : verify.isError
        ? verify.error instanceof ApiError && verify.error.code === 'EMAIL_VERIFICATION_INVALID'
          ? 'invalid'
          : 'failed'
        : 'verifying';

  const view = {
    verifying: {
      icon: (
        <Loader2
          aria-hidden="true"
          className="text-brand size-12 animate-spin motion-reduce:animate-none"
        />
      ),
      title: 'Verifying your email…',
      body: 'This only takes a moment.',
    },
    verified: {
      icon: <CircleCheck aria-hidden="true" className="text-success size-12" />,
      title: 'Your email is verified',
      body: 'Thanks for confirming. You’re all set.',
    },
    invalid: {
      icon: <CircleX aria-hidden="true" className="text-danger size-12" />,
      title: 'This link doesn’t work',
      body: 'It may have expired, or it was already used. If you verified your email before, there’s nothing else to do.',
    },
    failed: {
      icon: <CircleX aria-hidden="true" className="text-danger size-12" />,
      title: 'We couldn’t verify your email',
      body: 'We can’t reach Waven right now. Open the link from the email again in a few minutes.',
    },
  }[outcome];

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center p-6">
      <section
        aria-live="polite"
        aria-busy={outcome === 'verifying'}
        className="bg-surface flex w-full max-w-md flex-col items-center gap-4 rounded-lg p-8 text-center"
      >
        <p className="font-heading flex items-center gap-2 text-lg font-semibold">
          <EqualizerMark />
          Waven
        </p>
        {view.icon}
        <h1 className="text-2xl font-bold tracking-tight">{view.title}</h1>
        <p className="text-muted-foreground text-sm">{view.body}</p>
        {outcome === 'verifying' ? null : (
          <Button asChild className="bg-brand text-primary-foreground hover:bg-brand-hover mt-2">
            <Link href="/">Go to Waven</Link>
          </Button>
        )}
      </section>
    </main>
  );
}
