'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Gem,
  LoaderCircle,
  type LucideIcon,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from 'cn';
import { ErrorState, LoadingStatus } from '@/components/catalog/states';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminReady } from './admin-gate';
import { type AdminStats, adminStatsQuery } from '@/lib/api/admin';
import { pluralize } from '@/lib/format';
import { PageHeader, SelectField } from './table';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
] as const;
type Range = (typeof RANGES)[number]['value'];

const CARD = 'bg-surface flex flex-col gap-4 rounded-lg p-5';

/** Basic metrics (US-19): users, Premium users, plays per day and most played tracks. */
export function DashboardView() {
  const ready = useAdminReady();
  const [range, setRange] = useState<Range>('14');
  const stats = useQuery({
    ...adminStatsQuery(Number(range)),
    enabled: ready,
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="How Waven is doing."
        actions={
          <SelectField
            label="Time range for plays"
            value={range}
            onChange={setRange}
            options={RANGES}
            className="w-40"
          />
        }
      />
      {stats.isError && !stats.data ? (
        <ErrorState
          title="We couldn't load the metrics"
          onRetry={() => void stats.refetch()}
          retrying={stats.isFetching}
        />
      ) : stats.data ? (
        <Metrics stats={stats.data} stale={stats.isPlaceholderData} />
      ) : (
        <DashboardSkeleton />
      )}
    </div>
  );
}

function Metrics({ stats, stale }: { stats: AdminStats; stale: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Users} label="Users" value={stats.users.total} />
        <StatTile icon={Gem} label="Premium users" value={stats.users.premium} />
        <StatTile icon={UserPlus} label="New in the last 7 days" value={stats.users.newLast7Days} />
        <StatTile icon={ShieldCheck} label="Admins" value={stats.users.admins} />
      </dl>
      <div className={cn('grid gap-6 transition-opacity lg:grid-cols-5', stale && 'opacity-75')}>
        <PlaysChart days={stats.playsPerDay} className="lg:col-span-3" />
        <TopTracks tracks={stats.topTracks} className="lg:col-span-2" />
      </div>
      <TrackStatusCard tracks={stats.tracks} />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-surface flex flex-col gap-2 rounded-lg p-5">
      <dt className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </dt>
      <dd className="text-3xl font-bold tabular-nums">{value.toLocaleString('en')}</dd>
    </div>
  );
}

const shortDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/** Single-series column chart: brand bars from a zero baseline, a hover tooltip and a data table. */
function PlaysChart({ days, className }: { days: AdminStats['playsPerDay']; className?: string }) {
  const id = useId();
  const max = Math.max(1, ...days.map((day) => day.plays));
  const total = days.reduce((sum, day) => sum + day.plays, 0);
  const [showTable, setShowTable] = useState(false);
  // Label about five days along the axis, whatever the range.
  const labelEvery = Math.max(1, Math.ceil(days.length / 5));

  return (
    <section aria-labelledby={`${id}-title`} className={cn(CARD, className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            Plays per day
          </h2>
          <p className="text-muted-foreground text-sm">
            {pluralize(total, 'play')} in {days.length} days (UTC)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-expanded={showTable}
          aria-controls={`${id}-table`}
          className="text-muted-foreground hover:text-foreground rounded-md text-sm font-medium underline-offset-4 hover:underline"
        >
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <table id={`${id}-table`} className="w-full text-left text-sm">
          <caption className="sr-only">Plays per day</caption>
          <thead className="text-muted-foreground text-xs uppercase">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Day
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Plays
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className="border-border border-t">
                <td className="py-1.5">{shortDay(day.date)}</td>
                <td className="py-1.5 text-right tabular-nums">{day.plays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div id={`${id}-table`}>
          <div className="flex h-48 gap-0.5" role="list" aria-label="Plays per day">
            {days.map((day) => (
              <div
                key={day.date}
                role="listitem"
                tabIndex={0}
                aria-label={`${shortDay(day.date)}: ${pluralize(day.plays, 'play')}`}
                className="group relative flex h-full flex-1 flex-col justify-end rounded-sm outline-offset-2"
              >
                {/* Tooltip: hover or keyboard focus. */}
                <span className="bg-elevated text-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md px-2 py-1 text-xs whitespace-nowrap shadow-md group-hover:block group-focus-visible:block">
                  {shortDay(day.date)} · {pluralize(day.plays, 'play')}
                </span>
                <span
                  aria-hidden="true"
                  className="bg-brand group-hover:bg-brand-hover block w-full rounded-t-sm transition-colors"
                  style={{ height: day.plays === 0 ? '2px' : `${(day.plays / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="border-border text-muted-foreground flex gap-0.5 border-t pt-1 text-xs"
          >
            {days.map((day, index) => (
              <span key={day.date} className="flex-1 overflow-visible whitespace-nowrap">
                {index % labelEvery === 0 ? shortDay(day.date) : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TopTracks({ tracks, className }: { tracks: AdminStats['topTracks']; className?: string }) {
  const id = useId();
  const max = Math.max(1, ...tracks.map((track) => track.playCount));
  return (
    <section aria-labelledby={`${id}-title`} className={cn(CARD, className)}>
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          Most played tracks
        </h2>
        <p className="text-muted-foreground text-sm">All-time plays</p>
      </div>
      {tracks.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing has been played yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {tracks.map((track) => (
            <li key={track.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{track.title}</span>
                  <span className="text-muted-foreground"> · {track.artist.name}</span>
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {pluralize(track.playCount, 'play')}
                </span>
              </div>
              <div aria-hidden="true" className="bg-surface-2 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-brand h-full rounded-full"
                  style={{ width: `${(track.playCount / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const STATUS_ROWS = [
  { key: 'ready', label: 'Ready', icon: CircleCheck, className: 'text-success' },
  { key: 'processing', label: 'Processing', icon: LoaderCircle, className: 'text-brand' },
  { key: 'pending', label: 'Waiting for audio', icon: Clock, className: 'text-warning' },
  { key: 'failed', label: 'Failed', icon: CircleAlert, className: 'text-danger' },
] as const;

function TrackStatusCard({ tracks }: { tracks: AdminStats['tracks'] }) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className={CARD}>
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          Catalog
        </h2>
        <p className="text-muted-foreground text-sm">
          {pluralize(tracks.total, 'track')}, by transcoding status
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS_ROWS.map(({ key, label, icon: Icon, className }) => (
          <div
            key={key}
            className="bg-surface-2 flex items-center justify-between rounded-md px-4 py-3"
          >
            <dt className="flex items-center gap-2 text-sm">
              <Icon aria-hidden="true" className={cn('size-4', className)} />
              {label}
            </dt>
            <dd className="font-semibold tabular-nums">{tracks[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <LoadingStatus label="Loading metrics" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-72 rounded-lg lg:col-span-3" />
        <Skeleton className="h-72 rounded-lg lg:col-span-2" />
      </div>
      <Skeleton className="h-36 rounded-lg" />
    </div>
  );
}
