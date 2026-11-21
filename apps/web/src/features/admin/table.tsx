'use client';

import { ChevronLeft, ChevronRight, type LucideIcon, Search } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { cn } from 'cn';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_PAGE_SIZE, pageInfo } from '@/lib/api/admin';

export const FIELD =
  'bg-surface-2 border-input text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm';
export const PRIMARY_BUTTON = 'bg-brand text-primary-foreground hover:bg-brand-hover';

const SEARCH_DEBOUNCE_MS = 250;

/** Search text plus page offset; a new search goes back to the first page. */
export function useTableState() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  return { search, setSearch, q, offset, setOffset, limit: ADMIN_PAGE_SIZE };
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}

export function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        maxLength={100}
        className={cn(FIELD, 'pl-9')}
      />
    </div>
  );
}

export function SelectField<T extends string>({
  value,
  onChange,
  label,
  options,
  className,
  disabled,
}: {
  value: T;
  onChange: (value: T) => void;
  label: string;
  options: readonly { value: T; label: string }[];
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(FIELD, 'pr-8 disabled:opacity-50')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-foreground',
  brand: 'bg-brand/15 text-brand',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
};

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONES[tone],
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hidden below the `sm` breakpoint to keep narrow tables readable. */
  optional?: boolean;
}

interface DataTableProps<T> {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[] | undefined;
  rowKey: (row: T) => string;
  loading: boolean;
  /** Shown faded while a new page or search loads over the old rows. */
  stale?: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty: { icon: LucideIcon; title: string; description?: string };
}

/** A plain, accessible table with skeleton rows, an empty state and an error state. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading,
  stale = false,
  error = false,
  onRetry,
  empty,
}: DataTableProps<T>) {
  if (error && !rows) {
    return (
      <ErrorState
        title={`We couldn't load ${caption.toLowerCase()}`}
        onRetry={onRetry ?? (() => {})}
      />
    );
  }
  if (rows && rows.length === 0 && !loading) {
    return <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />;
  }

  return (
    <div className="bg-surface overflow-x-auto rounded-lg">
      {loading && !rows ? <LoadingStatus label={`Loading ${caption.toLowerCase()}`} /> : null}
      <table
        className={cn('w-full text-left text-sm transition-opacity', stale && 'opacity-75')}
        aria-busy={loading || undefined}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className="text-muted-foreground border-border border-b text-xs tracking-wide uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn(
                  'px-4 py-3 font-medium',
                  column.optional && 'max-sm:hidden',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows
            ? rows.map((row) => (
                <tr key={rowKey(row)} className="border-border border-b last:border-0">
                  {columns.map((column) => (
                    <td
                      key={column.header}
                      className={cn(
                        'px-4 py-3 align-middle',
                        column.optional && 'max-sm:hidden',
                        column.className,
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            : Array.from({ length: 5 }, (_, index) => (
                <tr key={index} className="border-border border-b last:border-0">
                  {columns.map((column) => (
                    <td
                      key={column.header}
                      className={cn('px-4 py-3', column.optional && 'max-sm:hidden')}
                    >
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  total,
  offset,
  limit,
  onChange,
  label,
}: {
  total: number | undefined;
  offset: number;
  limit: number;
  onChange: (offset: number) => void;
  label: string;
}) {
  const info = pageInfo(total ?? 0, offset, limit);
  return (
    <nav aria-label={`${label} pages`} className="flex items-center justify-between gap-4 text-sm">
      {/* Fixed height so the footer does not jump while the total loads. */}
      <p className="text-muted-foreground min-h-5 tabular-nums" aria-live="polite">
        {total === undefined ? '' : `${info.from}–${info.to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground tabular-nums">
          Page {info.page} of {info.pages}
        </span>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Previous page"
          disabled={!info.hasPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Next page"
          disabled={!info.hasNext}
          onClick={() => onChange(offset + limit)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

/** `21 Nov 2026`, in the viewer's locale and time zone. */
export function formatDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}
