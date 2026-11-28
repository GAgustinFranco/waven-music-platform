'use client';

import { ChevronDown, ListMusic } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { CoverImage } from '@/components/catalog/cover-image';
import { TransportControls, VolumeControl } from '@/components/player/controls';
import { SeekBar } from '@/components/player/seek-bar';
import { Button } from '@/components/ui/button';
import { useAnimationFrame } from '@/features/auth/backdrop/shared';
import type { Track } from '@/lib/api/catalog';
import { coverColor } from '@/lib/cover-color';
import { DURATION, EASE_STANDARD } from '@/lib/motion';
import { type DynamicPalette, dynamicPalette } from '@/lib/palette';
import { selectCurrentTrack, selectUpcoming, usePlayerStore } from '@/stores/player.store';
import { MESH_BLOBS, type MeshClock, blobOffset, paletteTokens, stepMesh } from './mesh';

/** How many upcoming tracks the view lists; the queue page has the rest. */
const UP_NEXT_LIMIT = 5;

/** The Dynamic palette of a cover, whatever theme the user picked. */
function useCoverPalette(track: Track | null): DynamicPalette | null {
  const [palette, setPalette] = useState<DynamicPalette | null>(null);
  const url = track?.album.cover?.sm;
  const fallback = track?.album.dominantColor;
  useEffect(() => {
    let cancelled = false;
    void coverColor(url, fallback).then((color) => {
      if (!cancelled) {
        setPalette(color ? dynamicPalette(color) : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url, fallback]);
  return palette;
}

/**
 * Blurred blobs in the cover's colors drifting behind the view. They slow to a
 * crawl while paused and stand still under prefers-reduced-motion. Only
 * transforms change, so it stays on the compositor.
 */
function MeshBackground() {
  const blobs = useRef<(HTMLDivElement | null)[]>([]);
  const clock = useRef<MeshClock>({ phase: 0, speed: 0 });
  const last = useRef<number | null>(null);
  const playing = usePlayerStore((state) => state.isPlaying);
  const reduceMotion = useReducedMotion() ?? false;

  useAnimationFrame((now) => {
    const dt = last.current === null ? 0 : (now - last.current) / 1000;
    last.current = now;
    clock.current = stepMesh(clock.current, dt, playing);
    MESH_BLOBS.forEach((blob, index) => {
      const { x, y } = blobOffset(blob, clock.current.phase);
      blobs.current[index]?.style.setProperty(
        'transform',
        `translate3d(calc(-50% + ${x}vw), calc(-50% + ${y}vh), 0)`,
      );
    });
  }, !reduceMotion);

  return (
    <div aria-hidden="true" className="now-playing-mesh pointer-events-none absolute inset-0">
      {MESH_BLOBS.map((blob, index) => (
        <div
          key={index}
          ref={(element) => {
            blobs.current[index] = element;
          }}
          className={`now-playing-blob now-playing-blob-${index + 1}`}
          style={{ left: `${blob.x}%`, top: `${blob.y}%` }}
        />
      ))}
    </div>
  );
}

function UpNext({ onNavigate }: { onNavigate: () => void }) {
  const tracks = usePlayerStore((state) => state.tracks);
  const order = usePlayerStore((state) => state.order);
  const position = usePlayerStore((state) => state.position);
  const playAt = usePlayerStore((state) => state.playAt);
  const upcoming = selectUpcoming({ tracks, order, position }).slice(0, UP_NEXT_LIMIT);

  return (
    <section aria-labelledby="up-next-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 id="up-next-heading" className="text-sm font-semibold">
          Up next
        </h3>
        <Link
          href="/queue"
          onClick={onNavigate}
          className="text-muted-foreground hover:text-foreground rounded-sm text-sm hover:underline"
        >
          Open queue
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing else in the queue.</p>
      ) : (
        <ol className="flex flex-col">
          {upcoming.map(({ track, position: at }) => (
            <li key={`${track.id}:${at}`}>
              <button
                type="button"
                onClick={() => playAt(at)}
                aria-label={`Play ${track.title} by ${track.artist.name}`}
                className="hover:bg-foreground/10 flex w-full items-center gap-3 rounded-md p-2 text-left"
              >
                <CoverImage image={track.album.cover} sizes="40px" className="size-10 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{track.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {track.artist.name}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

interface NowPlayingViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shared with the opener's cover, so the big cover grows out of it. */
  layoutId: string;
  /** The openers (`NowPlayingTrigger`s) and anything around them. */
  children: ReactNode;
}

/**
 * Full-screen Now Playing: the cover grown from the player, title, artist,
 * controls and the next tracks over a mesh gradient in the cover's palette. A
 * modal dialog: focus is trapped, Esc closes it and focus returns to the opener.
 */
export function NowPlayingView({ open, onOpenChange, layoutId, children }: NowPlayingViewProps) {
  const track = usePlayerStore(selectCurrentTrack);
  const palette = useCoverPalette(open ? track : null);
  // The player bar has two openers; Radix only refocuses one of them.
  const opener = useRef<HTMLElement | null>(null);
  const close = () => onOpenChange(false);
  const change = (next: boolean) => {
    if (next && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
    }
    onOpenChange(next);
  };

  return (
    <DialogPrimitive.Root open={open && track !== null} onOpenChange={change}>
      {children}
      <AnimatePresence>
        {open && track ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content
              forceMount
              asChild
              aria-describedby={undefined}
              onCloseAutoFocus={(event) => {
                // Back to the opener actually used, without scrolling the page.
                event.preventDefault();
                opener.current?.focus({ preventScroll: true });
              }}
            >
              <motion.div
                className="now-playing bg-background text-foreground fixed inset-0 z-50 overflow-hidden outline-none"
                style={paletteTokens(palette) as CSSProperties}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION.panel, ease: EASE_STANDARD }}
              >
                <MeshBackground />
                <div className="now-playing-content relative flex h-full flex-col overflow-y-auto">
                  <header className="px-gutter md:px-gutter-lg flex items-center justify-between pt-2 md:pt-4">
                    <DialogPrimitive.Close asChild>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        aria-label="Close Now Playing"
                        className="hover:bg-foreground/10 rounded-full"
                      >
                        <ChevronDown aria-hidden="true" className="size-6" />
                      </Button>
                    </DialogPrimitive.Close>
                    <DialogPrimitive.Title className="text-sm font-medium">
                      Now playing
                    </DialogPrimitive.Title>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-lg"
                      className="hover:bg-foreground/10 rounded-full"
                    >
                      <Link href="/queue" aria-label="Queue" onClick={close}>
                        <ListMusic aria-hidden="true" className="size-5" />
                      </Link>
                    </Button>
                  </header>

                  <div className="px-gutter md:px-gutter-lg pb-gutter mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 py-6 md:grid-cols-2 md:gap-12">
                    <motion.div
                      layoutId={layoutId}
                      className="mx-auto aspect-square w-full max-w-md shadow-2xl md:max-w-lg"
                    >
                      <CoverImage
                        image={track.album.cover}
                        sizes="(min-width: 768px) 512px, 100vw"
                        priority
                        className="size-full"
                      />
                    </motion.div>

                    <div className="flex min-w-0 flex-col gap-6">
                      <div className="flex min-w-0 flex-col gap-1">
                        <Link
                          href={`/albums/${track.album.id}`}
                          onClick={close}
                          className="self-start truncate rounded-sm text-2xl font-bold hover:underline md:text-4xl"
                        >
                          {track.title}
                        </Link>
                        <Link
                          href={`/artists/${track.artist.id}`}
                          onClick={close}
                          className="text-muted-foreground hover:text-foreground self-start truncate rounded-sm text-base hover:underline md:text-lg"
                        >
                          {track.artist.name}
                        </Link>
                      </div>
                      <SeekBar />
                      <TransportControls size="lg" />
                      <div className="flex justify-center">
                        <VolumeControl />
                      </div>
                      <UpNext onNavigate={close} />
                    </div>
                  </div>
                </div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/** Opens the view; renders its child (a button). */
export function NowPlayingTrigger({ children }: { children: ReactNode }) {
  return <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>;
}
