import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ImageSet } from '@/lib/api/catalog';
import { dominantColorStyle } from '@/lib/dominant-color';
import { CoverImage } from './cover-image';

interface DominantHeaderProps {
  /** "Album", "Artist"… shown above the title. */
  kind: string;
  title: string;
  image: ImageSet | null;
  imageShape?: 'square' | 'round';
  dominantColor: string | null;
  /** Meta line under the title (artist link, year, track count…). */
  children?: ReactNode;
}

const HEADER =
  'dominant-header px-gutter lg:px-gutter-lg flex flex-col gap-4 pt-20 pb-6 sm:flex-row sm:items-end sm:gap-6 lg:pt-28';
const COVER = 'aspect-square w-40 shrink-0 self-center sm:w-48 sm:self-auto lg:w-58';

/** Page header with the dominant-color gradient (color → --bg). */
export function DominantHeader({
  kind,
  title,
  image,
  imageShape = 'square',
  dominantColor,
  children,
}: DominantHeaderProps) {
  return (
    <header className={HEADER} style={dominantColorStyle(dominantColor)}>
      <CoverImage
        image={image}
        shape={imageShape}
        sizes="(min-width: 1024px) 232px, (min-width: 640px) 192px, 160px"
        priority
        className={`${COVER} shadow-xl`}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm font-medium">{kind}</p>
        <h1 className="text-3xl font-bold tracking-tight break-words lg:text-5xl">{title}</h1>
        {children ? <div className="text-sm">{children}</div> : null}
      </div>
    </header>
  );
}

export function DominantHeaderSkeleton({ shape = 'square' }: { shape?: 'square' | 'round' }) {
  return (
    <div aria-hidden="true" className={HEADER}>
      <Skeleton className={`${COVER} ${shape === 'round' ? 'rounded-full' : ''}`} />
      <div className="flex w-full flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
