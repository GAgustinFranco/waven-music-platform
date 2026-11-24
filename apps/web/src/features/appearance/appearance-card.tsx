'use client';

import { Check, Gem, Lock } from 'lucide-react';
import Link from 'next/link';
import { useId } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUpdateMe } from '@/features/profile/use-update-me';
import type { Me } from '@/lib/api/client';
import { BACKDROP_OPTIONS, type Backdrop, type Theme, THEME_OPTIONS } from '@/lib/theme';

const CARD = 'bg-surface flex flex-col gap-5 rounded-lg p-5 sm:p-6 lg:col-span-2';

/**
 * Theme and backdrop picker (Premium). Each preview is a small mock of the app
 * under its own `data-theme`, so it shows the real tokens. Free users see the
 * themes locked and a link to Premium; saving is instant.
 */
export function AppearanceCard({ me }: { me: Me }) {
  const id = useId();
  const premium = me.plan === 'premium';
  const update = useUpdateMe();
  const current = me.appearance;

  const save = (changes: { theme?: Theme; backdrop?: Backdrop }) => {
    update.mutate(changes, {
      onError: () => toast.error('Couldn’t change the theme. Try again.'),
    });
  };

  return (
    <section aria-labelledby={`${id}-title`} className={CARD}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`${id}-title`} className="text-xl font-semibold">
          Appearance
        </h2>
        <span className="bg-brand/15 text-brand inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
          <Gem aria-hidden="true" className="size-3.5" />
          Premium
        </span>
      </div>
      <p className="text-muted-foreground max-w-2xl text-sm">
        Pick the colors of Waven. Type, sizes and layout stay the same.
        {premium ? null : ' On the Free plan Waven uses Midnight Violet.'}
      </p>

      <div
        role="radiogroup"
        aria-labelledby={`${id}-title`}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {THEME_OPTIONS.map((option) => {
          const selected = current.theme === option.id;
          const locked = !premium && option.id !== 'violet';
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={locked || undefined}
              disabled={update.isPending}
              onClick={() => (locked || selected ? undefined : save({ theme: option.id }))}
              className={
                selected
                  ? 'border-brand flex flex-col gap-2 rounded-md border-2 p-2 text-left'
                  : 'border-border hover:border-input flex flex-col gap-2 rounded-md border-2 p-2 text-left'
              }
            >
              <ThemePreview theme={option.id} glow={current.backdrop === 'glow'} />
              <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{option.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{option.note}</span>
                </span>
                {selected ? (
                  <Check aria-hidden="true" className="text-brand size-4 shrink-0" />
                ) : locked ? (
                  <Lock aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                ) : null}
              </span>
              {locked ? <span className="sr-only">Premium only</span> : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <p id={`${id}-backdrop`} className="text-sm font-semibold">
          Backdrop
        </p>
        <div role="radiogroup" aria-labelledby={`${id}-backdrop`} className="flex flex-wrap gap-2">
          {BACKDROP_OPTIONS.map((option) => {
            const selected = current.backdrop === option.id;
            const locked = !premium && option.id !== 'solid';
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={locked || undefined}
                disabled={update.isPending}
                onClick={() => (locked || selected ? undefined : save({ backdrop: option.id }))}
                className={
                  selected
                    ? 'bg-brand text-primary-foreground inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold'
                    : 'border-input inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold'
                }
              >
                {locked ? <Lock aria-hidden="true" className="size-3.5" /> : null}
                {option.name}
              </button>
            );
          })}
        </div>
      </div>

      {premium ? null : (
        <div className="bg-surface-2 flex flex-col gap-3 rounded-md p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Unlock 7 themes, a soft-glow backdrop and the Dynamic theme.</p>
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

/** A tiny mock of the app drawn with the theme's own tokens. */
function ThemePreview({ theme, glow }: { theme: Theme; glow: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-theme={theme}
      className={
        glow
          ? 'theme-glow bg-background flex h-20 overflow-hidden rounded-sm'
          : 'bg-background flex h-20 overflow-hidden rounded-sm'
      }
    >
      <span className="bg-surface w-5" />
      <span className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="flex gap-1">
          <span className="bg-brand size-4 rounded-xs" />
          <span className="bg-brand-2 size-4 rounded-xs" />
          <span className="bg-elevated size-4 rounded-xs" />
        </span>
        <span className="bg-surface-2 h-1.5 w-3/4 rounded-full" />
        <span className="mt-auto flex items-center gap-1.5">
          <span className="bg-brand size-2.5 rounded-full" />
          <span className="bg-surface-2 h-1 flex-1 overflow-hidden rounded-full">
            <span className="bg-brand block h-full w-2/5" />
          </span>
        </span>
      </span>
    </span>
  );
}
