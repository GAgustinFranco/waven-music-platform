import { Music } from 'lucide-react';

/**
 * Reserves the 88 px player bar from 768 px up. Phase 4 replaces the idle content
 * with the real player; on mobile the mini player will sit above the bottom nav.
 */
export function PlayerBarSlot() {
  return (
    <section
      aria-label="Player"
      className="h-player bg-surface border-border px-gutter-lg hidden items-center gap-3 border-t md:col-span-full md:flex"
    >
      <Music aria-hidden="true" className="text-muted-foreground size-5" />
      <p className="text-muted-foreground text-sm">Nothing playing yet.</p>
    </section>
  );
}
