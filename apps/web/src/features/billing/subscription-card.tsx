'use client';

import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { billingStatusQuery } from '@/lib/api/billing';
import { useCancelSubscription } from './mutations';
import { describeSubscription, formatLongDate, formatPrice } from './subscription';

const TONE = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  muted: 'bg-surface-2 text-muted-foreground',
} as const;

/** Subscription status and cancellation (US-15), shown on the profile page. */
export function SubscriptionCard({ enabled }: { enabled: boolean }) {
  const id = useId();
  const status = useQuery({ ...billingStatusQuery(), enabled });
  const cancel = useCancelSubscription();
  const [confirming, setConfirming] = useState(false);

  if (status.isPending) {
    return <Skeleton className="h-40 rounded-lg lg:col-span-2" />;
  }
  const subscription = status.data?.subscription ?? null;
  if (status.isError || !subscription) {
    // Nothing to manage: the plan card already links to Premium.
    return null;
  }

  const summary = describeSubscription(subscription);
  const recurring = subscription.mode === 'preapproval';
  const end = formatLongDate(subscription.currentPeriodEnd);

  const onConfirm = () => {
    cancel.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        toast.success('Subscription cancelled');
      },
      onError: () => toast.error('Couldn’t cancel your subscription. Try again.'),
    });
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="bg-surface flex flex-col gap-4 rounded-lg p-5 sm:p-6 lg:col-span-2 border border-transparent transition-[border-color,box-shadow] duration-200 ease-standard hover:border-foreground/12 hover:shadow-lg hover:shadow-black/30 focus-within:border-foreground/12"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-xl font-semibold">
          <CreditCard aria-hidden="true" className="text-muted-foreground size-5" />
          Subscription
        </h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE[summary.tone]}`}>
          {summary.label}
        </span>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Billing</dt>
          <dd>{recurring ? 'Monthly, Mercado Pago' : '30 days, Mercado Pago'}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Price</dt>
          <dd className="tabular-nums">
            {formatPrice(subscription.amount, subscription.currency)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Paid until</dt>
          <dd>{end ?? '—'}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">{summary.detail}</p>
        {summary.cancellable ? (
          <Button variant="outline" className="shrink-0" onClick={() => setConfirming(true)}>
            {subscription.status === 'pending' ? 'Cancel checkout' : 'Cancel subscription'}
          </Button>
        ) : null}
      </div>

      <Dialog open={confirming} onOpenChange={(open) => !cancel.isPending && setConfirming(open)}>
        <DialogContent>
          <DialogTitle>
            {subscription.status === 'pending' ? 'Cancel this checkout?' : 'Cancel Premium?'}
          </DialogTitle>
          <DialogDescription>
            {subscription.status === 'pending'
              ? 'The pending Mercado Pago checkout is dropped, so you can start a new one.'
              : end
                ? `${recurring ? 'Mercado Pago stops charging you. ' : ''}You keep Premium until ${end}, then move to Free.`
                : 'Mercado Pago stops charging you and you move to Free.'}
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={cancel.isPending}
              onClick={() => setConfirming(false)}
            >
              Keep it
            </Button>
            <Button variant="destructive" disabled={cancel.isPending} onClick={onConfirm}>
              {cancel.isPending ? 'Cancelling…' : 'Yes, cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
