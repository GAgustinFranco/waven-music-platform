import { Heart, ListMusic } from 'lucide-react';
import { cn } from 'cn';
import { CoverImage } from '@/components/catalog/cover-image';
import type { ImageSet } from '@/lib/api/catalog';

/**
 * A playlist has no cover of its own in the MVP: one album cover, or a 2×2
 * mosaic once it holds four different albums.
 */
export function PlaylistCover({
  covers,
  sizes,
  className,
  priority = false,
}: {
  covers: ImageSet[];
  /** Rendered width of the whole cover. */
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const [first] = covers;
  if (covers.length >= 4) {
    return (
      <div className={cn('grid aspect-square grid-cols-2 overflow-hidden rounded-md', className)}>
        {covers.slice(0, 4).map((cover) => (
          <CoverImage
            key={cover.md}
            image={cover}
            sizes={`calc(${sizes} / 2)`}
            priority={priority}
            className="size-full rounded-none"
          />
        ))}
      </div>
    );
  }
  if (first) {
    return <CoverImage image={first} sizes={sizes} priority={priority} className={className} />;
  }
  return (
    <div
      className={cn(
        'bg-surface-2 text-muted-foreground flex aspect-square items-center justify-center rounded-md',
        className,
      )}
    >
      <ListMusic aria-hidden="true" className="size-1/3" />
    </div>
  );
}

/** The cover of the Liked Songs collection. */
export function LikedSongsCover({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'from-brand to-brand-2 text-foreground flex aspect-square items-center justify-center rounded-md bg-linear-135',
        className,
      )}
    >
      <Heart aria-hidden="true" className="size-1/3 fill-current" />
    </div>
  );
}
