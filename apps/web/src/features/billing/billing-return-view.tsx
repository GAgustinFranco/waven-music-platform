'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleDashed, CircleX, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { billingStatusQuery } from '@/lib/api/billing';
import { meKeys } from '@/lib/api/queries';
import { checkoutOutcome } from './subscription';

const POLL_MS = 2000;
/** After this long the page stops polling and says the confirmation may come later. */
const GIVE_UP_MS = 60_000;

/**
 * Where Mercado Pago sends the buyer back (ARCHITECTURE §4, payment flow). The
 * webhook may land a few seconds later, so it polls `GET /billing/subscription`
 * until the subscription leaves `pending`.
 */
export function BillingReturnView() {
  const ready = useSessionReady();
  const queryClient = useQueryClient();
  const [gaveUp, setGaveUp] = useState(false);

  const status = useQuery({
    ...billingStatusQuery(),
    enabled: ready,
    refetchInterval: (query) => {
      const data = query.state.data;
      return gaveUp || (data && checkoutOutcome(data) !== 'waiting') ? false : POLL_MS;
    },
  });
  const outcome = status.data ? checkoutOutcome(status.data) : 'waiting';

  useEffect(() => {
    const timer = window.setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (outcome === 'premium') {
      // The plan, its limits and the stream quality all come from /me.
      void queryClient.invalidateQueries({ queryKey: meKeys.all });
    }
  }, [outcome, queryClient]);

  const view =
    outcome === 'premium'
      ? {
          icon: <CircleCheck aria-hidden="true" className="text-success size-12" />,
          title: 'Welcome to Premium',
          body: 'Your payment was confirmed. Enjoy unlimited playlists and 320 kbps audio.',
        }
      : outcome === 'not-completed'
        ? {
            icon: <CircleX aria-hidden="true" className="text-danger size-12" />,
            title: 'The payment wasn’t completed',
            body: 'Nothing was charged. You can try again from the Premium page.',
          }
        : gaveUp || status.isError
          ? {
              icon: <CircleDashed aria-hidden="true" className="text-warning size-12" />,
              title: 'Still waiting for Mercado Pago',
              body: 'The confirmation can take a few minutes. Your plan updates as soon as it arrives; check your profile later.',
            }
          : {
              icon: (
                <Loader2
                  aria-hidden="true"
                  className="text-brand size-12 animate-spin motion-reduce:animate-none"
                />
              ),
              title: 'Confirming your payment…',
              body: 'This usually takes a few seconds. Please keep this page open.',
            };

  return (
    <div className="px-gutter lg:px-gutter-lg flex justify-center pt-24 pb-10">
      <section
        aria-live="polite"
        aria-busy={outcome === 'waiting' && !gaveUp && !status.isError}
        className="bg-surface flex w-full max-w-md flex-col items-center gap-4 rounded-lg p-8 text-center"
      >
        {view.icon}
        <h1 className="text-2xl font-bold tracking-tight">{view.title}</h1>
        <p className="text-muted-foreground text-sm">{view.body}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {outcome === 'premium' ? (
            <Button asChild className="bg-brand text-primary-foreground hover:bg-brand-hover">
              <Link href="/">Start listening</Link>
            </Button>
          ) : outcome === 'not-completed' ? (
            <Button asChild className="bg-brand text-primary-foreground hover:bg-brand-hover">
              <Link href="/premium">Back to Premium</Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <Link href="/profile">Go to your profile</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
