import { Disc3, UserRound } from 'lucide-react';
import { cn } from 'cn';
import type { ImageSet } from '@/lib/api/catalog';

interface CoverImageProps {
  image: ImageSet | null;
  /** The rendered width, so the browser picks sm (64), md (300) or lg (640). */
  sizes: string;
  /** Decorative by default: titles are always rendered next to the cover. */
  alt?: string;
  shape?: 'square' | 'round';
  priority?: boolean;
  className?: string;
}

/**
 * The API already serves resized WebP covers, so a plain responsive <img> is used
 * instead of next/image (whose optimizer would re-encode them and refuses private IPs
 * in development).
 */
export function CoverImage({
  image,
  sizes,
  alt = '',
  shape = 'square',
  priority = false,
  className,
}: CoverImageProps) {
  const rounded = shape === 'round' ? 'rounded-full' : 'rounded-md';

  if (!image) {
    const Icon = shape === 'round' ? UserRound : Disc3;
    return (
      <div
        className={cn(
          'bg-surface-2 text-muted-foreground flex aspect-square items-center justify-center',
          rounded,
          className,
        )}
      >
        <Icon aria-hidden="true" className="size-1/3" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the component comment.
    <img
      src={image.md}
      srcSet={`${image.sm} 64w, ${image.md} 300w, ${image.lg} 640w`}
      sizes={sizes}
      alt={alt}
      width={300}
      height={300}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={cn('bg-surface-2 aspect-square object-cover', rounded, className)}
    />
  );
}
