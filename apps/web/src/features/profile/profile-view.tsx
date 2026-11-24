'use client';

import { useQuery } from '@tanstack/react-query';
import { Gem, ListMusic, Palette } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useId, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState, LoadingStatus } from '@/components/catalog/states';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { AppearanceCard } from '@/features/appearance/appearance-card';
import { SubscriptionCard } from '@/features/billing/subscription-card';
import type { Me } from '@/lib/api/client';
import { myPlaylistsQuery } from '@/lib/api/library';
import { meQuery } from '@/lib/api/queries';
import { formatMonthYear, initialsOf } from '@/lib/format';
import { DISPLAY_NAME_MAX, describePlan, planName, validateDisplayName } from './plan';
import { useUpdateMe } from './use-update-me';

const FIELD =
  'bg-surface-2 border-input text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm';
const CARD =
  'bg-surface flex flex-col gap-4 rounded-lg p-5 sm:p-6 border border-transparent transition-[border-color,box-shadow] duration-200 ease-standard hover:border-foreground/12 hover:shadow-lg hover:shadow-black/30 focus-within:border-foreground/12';

/** Profile and plan (US-02): edit the display name and see the plan and its limits. */
export function ProfileView() {
  const ready = useSessionReady();
  const me = useQuery({ ...meQuery(), enabled: ready });
  const playlists = useQuery({ ...myPlaylistsQuery(), enabled: ready });

  if (me.isPending) {
    return <ProfileSkeleton />;
  }
  if (me.isError) {
    return (
      <div className="px-gutter lg:px-gutter-lg pt-20">
        <ErrorState
          as="h1"
          title="We couldn't load your profile"
          onRetry={() => void me.refetch()}
          retrying={me.isFetching}
        />
      </div>
    );
  }

  const user = me.data;
  const memberSince = formatMonthYear(user.createdAt);

  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20">
      <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar className="size-24 text-3xl">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback>{initialsOf(user.displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-muted-foreground text-sm font-medium">Profile</p>
          <h1 className="truncate text-3xl font-bold tracking-tight">{user.displayName}</h1>
          <p className="text-muted-foreground truncate text-sm">
            {user.email}
            {memberSince ? <> · Member since {memberSince}</> : null}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Remounted after each save, so the field restarts from the saved name. */}
        <DisplayNameForm key={user.displayName} me={user} />
        <PlanCard me={user} playlistCount={playlists.data ? playlists.data.total : null} />
        <SubscriptionCard enabled={ready} />
        <AppearanceCard me={user} />
      </div>
    </div>
  );
}

function DisplayNameForm({ me }: { me: Me }) {
  const id = useId();
  const [name, setName] = useState(me.displayName);
  const [touched, setTouched] = useState(false);
  const update = useUpdateMe();
  const error = validateDisplayName(name);
  const unchanged = name.trim() === me.displayName;
  const showError = touched && error !== null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (error || unchanged) {
      return;
    }
    update.mutate(
      { displayName: name.trim() },
      {
        onSuccess: () => toast.success('Profile saved'),
        onError: () => toast.error("Couldn't save your profile. Try again."),
      },
    );
  };

  return (
    <section aria-labelledby={`${id}-title`} className={CARD}>
      <h2 id={`${id}-title`} className="text-xl font-semibold">
        Display name
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            Name shown in Waven
          </label>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
            maxLength={DISPLAY_NAME_MAX + 10}
            autoComplete="nickname"
            required
            aria-invalid={showError ? true : undefined}
            aria-describedby={`${id}-hint`}
            className={FIELD}
          />
          {/* Fixed-height line: the error replaces the hint instead of pushing the layout. */}
          <p
            id={`${id}-hint`}
            className={
              showError ? 'text-danger min-h-5 text-sm' : 'text-muted-foreground min-h-5 text-sm'
            }
          >
            {showError ? error : `Up to ${DISPLAY_NAME_MAX} characters.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={unchanged || update.isPending}
            className="bg-brand text-primary-foreground hover:bg-brand-hover"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
          {unchanged ? null : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setName(me.displayName);
                setTouched(false);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}

function PlanCard({ me, playlistCount }: { me: Me; playlistCount: number | null }) {
  const id = useId();
  const { playlists, themes, atLimit } = describePlan(me.limits, playlistCount);
  const premium = me.plan === 'premium';

  return (
    <section aria-labelledby={`${id}-title`} className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="text-xl font-semibold">
          Your plan
        </h2>
        <span
          className={
            premium
              ? 'bg-brand text-primary-foreground rounded-full px-3 py-1 text-xs font-semibold'
              : 'bg-surface-2 text-foreground rounded-full px-3 py-1 text-xs font-semibold'
          }
        >
          {planName(me.plan)}
        </span>
      </div>

      <dl className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <dt className="flex items-center gap-2 font-medium">
              <ListMusic aria-hidden="true" className="text-muted-foreground size-4" />
              {playlists.label}
            </dt>
            <dd className="text-muted-foreground font-mono tabular-nums">{playlists.value}</dd>
          </div>
          {/* Always rendered (empty until the count arrives) so nothing shifts. */}
          <div
            className="bg-surface-2 h-1.5 overflow-hidden rounded-full"
            aria-hidden={playlists.ratio === null ? true : undefined}
            role={playlists.ratio === null ? undefined : 'meter'}
            aria-label={playlists.ratio === null ? undefined : 'Playlists used'}
            aria-valuemin={playlists.ratio === null ? undefined : 0}
            aria-valuemax={playlists.ratio === null ? undefined : (me.limits.maxPlaylists ?? 0)}
            aria-valuenow={playlists.ratio === null ? undefined : (playlistCount ?? 0)}
            aria-valuetext={playlists.ratio === null ? undefined : playlists.value}
          >
            <div
              className={
                atLimit ? 'bg-warning h-full rounded-full' : 'bg-brand h-full rounded-full'
              }
              style={{ width: `${(playlists.ratio ?? 0) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <dt className="flex items-center gap-2 font-medium">
            <Palette aria-hidden="true" className="text-muted-foreground size-4" />
            Themes
          </dt>
          <dd className="text-muted-foreground">{themes}</dd>
        </div>
      </dl>

      {premium ? null : (
        <div className="bg-surface-2 mt-auto flex flex-col gap-3 rounded-md p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {atLimit
              ? 'You’ve used all your playlists. Premium removes the limit.'
              : 'Unlimited playlists and theme switching with Premium.'}
          </p>
          <Button
            asChild
            className="bg-brand text-primary-foreground hover:bg-brand-hover shrink-0"
          >
            <Link href="/premium">
              <Gem aria-hidden="true" />
              See Premium
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

/** Same boxes as the loaded page, so swapping it in does not shift the layout. */
function ProfileSkeleton() {
  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20" aria-busy="true">
      <LoadingStatus label="Loading your profile" />
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-60 rounded-lg" />
        <Skeleton className="h-60 rounded-lg" />
      </div>
    </div>
  );
}
