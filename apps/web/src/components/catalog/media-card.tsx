import type { ReactNode } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import type { ImageSet } from '@/lib/api/catalog';
import { CoverImage } from './cover-image';

interface MediaCardProps {
  href: string;
  title: string;
  subtitle?: string;
  image: ImageSet | null;
  shape?: 'square' | 'round';
  /** Replaces the image, e.g. a playlist mosaic. */
  cover?: ReactNode;
}

const CARD_SIZES = '(min-width: 1024px) 200px, 45vw';

/** Album or artist tile. The whole card is one link, named by its title. */
export const MEDIA_CARD_SIZES = CARD_SIZES;

export function MediaCard({
  href,
  title,
  subtitle,
  image,
  shape = 'square',
  cover,
}: MediaCardProps) {
  return (
    <Link
      href={href}
      className="group hover:bg-surface-2 flex flex-col gap-3 rounded-md p-2 transition-colors duration-150 ease-standard sm:p-3"
    >
      {cover ?? (
        <CoverImage image={image} sizes={CARD_SIZES} shape={shape} className="w-full shadow-md" />
      )}
      <span className={shape === 'round' ? 'text-center' : undefined}>
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle ? (
          <span className="text-muted-foreground block truncate text-sm">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}

export function MediaCardSkeleton({ shape = 'square' }: { shape?: 'square' | 'round' }) {
  return (
    <div className="flex flex-col gap-3 p-2 sm:p-3">
      <Skeleton className={`aspect-square w-full ${shape === 'round' ? 'rounded-full' : ''}`} />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/** Responsive grid of cards; fills the row with as many 160 px+ columns as fit. */
export function MediaGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-2 gap-1 sm:grid-cols-[repeat(auto-fill,minmax(--spacing(40),1fr))] sm:gap-2"
    >
      {children}
    </ul>
  );
}

export function MediaGridSkeleton({
  count = 6,
  shape,
}: {
  count?: number;
  shape?: 'square' | 'round';
}) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-1 sm:grid-cols-[repeat(auto-fill,minmax(--spacing(40),1fr))] sm:gap-2"
    >
      {Array.from({ length: count }, (_, index) => (
        <MediaCardSkeleton key={index} shape={shape} />
      ))}
    </div>
  );
}
