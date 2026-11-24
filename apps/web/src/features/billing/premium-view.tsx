'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Gem, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { ErrorState, LoadingStatus } from '@/components/catalog/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { billingStatusQuery, type PlanOffer, plansQuery } from '@/lib/api/billing';
import { useCheckout } from './mutations';
import { formatPrice, planFeatures } from './subscription';

/** Plans page (US-14): compares Free and Premium and starts the Mercado Pago checkout. */
export function PremiumView() {
  const ready = useSessionReady();
  const plans = useQuery({ ...plansQuery(), enabled: ready });
  const status = useQuery({ ...billingStatusQuery(), enabled: ready });

  if (plans.isPending || status.isPending) {
    return <PremiumSkeleton />;
  }
  if (plans.isError || status.isError) {
    return (
      <div className="px-gutter lg:px-gutter-lg pt-20">
        <ErrorState
          as="h1"
          title="We couldn't load the plans"
          onRetry={() => {
            void plans.refetch();
            void status.refetch();
          }}
          retrying={plans.isFetching || status.isFetching}
        />
      </div>
    );
  }

  const recurring = plans.data.mode === 'preapproval';
  const current = status.data;

  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20 pb-10">
      <header className="flex max-w-2xl flex-col gap-2">
        <p className="text-brand-2 flex items-center gap-2 text-sm font-semibold">
          <Gem aria-hidden="true" className="size-4" />
          Waven Premium
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Listen without limits</h1>
        <p className="text-muted-foreground">
          {recurring
            ? 'A monthly subscription paid with Mercado Pago. Cancel anytime and keep Premium until the end of the paid month.'
            : 'One payment with Mercado Pago gives you 30 days of Premium. It doesn’t renew by itself.'}
        </p>
      </header>

      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        {plans.data.items.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            recurring={recurring}
            current={current.plan === plan.id}
            subscriptionStatus={current.subscription?.status ?? null}
          />
        ))}
      </div>

      <p className="text-muted-foreground max-w-2xl text-sm">
        Payments run in the Mercado Pago sandbox: use a test buyer account, never a real card.
      </p>
    </div>
  );
}

interface PlanCardProps {
  plan: PlanOffer;
  recurring: boolean;
  current: boolean;
  subscriptionStatus: string | null;
}

function PlanCard({ plan, recurring, current, subscriptionStatus }: PlanCardProps) {
  const id = useId();
  const premium = plan.id === 'premium';
  const price =
    plan.amount === 0
      ? formatPrice(0, plan.currency)
      : `${formatPrice(plan.amount, plan.currency)} / ${recurring ? 'month' : '30 days'}`;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={
        premium
          ? 'bg-surface border-brand flex flex-col gap-5 rounded-lg border-2 p-6'
          : 'bg-surface border-border flex flex-col gap-5 rounded-lg border p-6'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            {plan.name}
          </h2>
          <p className="text-2xl font-bold tabular-nums">{price}</p>
        </div>
        {current ? (
          <span className="bg-surface-2 text-foreground rounded-full px-3 py-1 text-xs font-semibold">
            Your plan
          </span>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {planFeatures(plan.limits).map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <Check aria-hidden="true" className="text-success size-4 shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      {premium ? <PremiumAction current={current} subscriptionStatus={subscriptionStatus} /> : null}
    </section>
  );
}

function PremiumAction({
  current,
  subscriptionStatus,
}: {
  current: boolean;
  subscriptionStatus: string | null;
}) {
  const checkout = useCheckout();
  // The mutation stays pending while the browser leaves for Mercado Pago.
  const busy = checkout.isPending || checkout.isSuccess;

  // A cancelled subscription can still give Premium until its period ends; the user may subscribe again.
  const open =
    subscriptionStatus === 'pending' ||
    subscriptionStatus === 'authorized' ||
    subscriptionStatus === 'paused';
  if (open) {
    const note =
      subscriptionStatus === 'pending'
        ? 'A checkout is waiting for Mercado Pago’s confirmation.'
        : subscriptionStatus === 'paused'
          ? 'Your subscription is paused in Mercado Pago.'
          : 'You’re on Premium.';
    return (
      <div className="mt-auto flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">{note}</p>
        <Button asChild variant="secondary">
          <Link href="/profile">Manage subscription</Link>
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="bg-brand text-primary-foreground hover:bg-brand-hover mt-auto"
      disabled={busy}
      onClick={() => checkout.mutate()}
    >
      {busy ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          Opening Mercado Pago…
        </>
      ) : (
        <>
          <Gem aria-hidden="true" />
          {current ? 'Subscribe again' : 'Get Premium'}
        </>
      )}
    </Button>
  );
}

/** Same boxes as the loaded page, so nothing shifts when it arrives. */
function PremiumSkeleton() {
  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20" aria-busy="true">
      <LoadingStatus label="Loading the plans" />
      <div className="flex max-w-2xl flex-col gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}
