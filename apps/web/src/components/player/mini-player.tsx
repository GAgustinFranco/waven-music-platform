'use client';

import { ChevronDown, ListMusic } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CoverImage } from '@/components/catalog/cover-image';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { dominantColorStyle } from '@/lib/dominant-color';
import { selectCurrentTrack, usePlayerStore } from '@/stores/player.store';
import { PlayPauseButton, TransportControls, VolumeControl } from './controls';
import { NowPlaying } from './now-playing';
import { ProgressLine, SeekBar } from './seek-bar';

/**
 * Mobile (< 768 px): a mini player above the bottom navigation that opens the
 * full-screen player as a sheet.
 */
export function MiniPlayer() {
  const track = usePlayerStore(selectCurrentTrack);
  const [open, setOpen] = useState(false);

  if (!track) {
    return null;
  }

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <section aria-label="Player" className="bg-surface-2 relative md:hidden">
        <div className="h-mini-player px-gutter flex items-center gap-3">
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label={`Open player: ${track.title} by ${track.artist.name}`}
              className="min-w-0 flex-1 rounded-md text-left"
            >
              <NowPlaying track={track} links={false} />
            </button>
          </SheetTrigger>
          <PlayPauseButton size="sm" />
        </div>
        <ProgressLine className="absolute inset-x-0 bottom-0" />
      </section>

      {/* Tinted with the cover for every plan, as music apps usually do. */}
      <SheetContent
        className="dominant-header px-gutter pb-gutter gap-6 pt-2"
        style={dominantColorStyle(track.album.dominantColor)}
      >
        <div className="flex items-center justify-between">
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Minimize player"
              className="rounded-full"
            >
              <ChevronDown aria-hidden="true" className="size-6" />
            </Button>
          </SheetClose>
          <SheetTitle className="text-sm font-medium">Now playing</SheetTitle>
          <Button asChild variant="ghost" size="icon-lg" className="rounded-full">
            <Link href="/queue" aria-label="Queue" onClick={close}>
              <ListMusic aria-hidden="true" className="size-5" />
            </Link>
          </Button>
        </div>
        <SheetDescription className="sr-only">
          Playback controls for the current track.
        </SheetDescription>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <CoverImage
            image={track.album.cover}
            sizes="(min-width: 640px) 640px, 100vw"
            className="aspect-square max-h-full w-full max-w-md shadow-xl"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Link
            href={`/albums/${track.album.id}`}
            onClick={close}
            className="self-start truncate rounded-sm text-2xl font-bold hover:underline"
          >
            {track.title}
          </Link>
          <Link
            href={`/artists/${track.artist.id}`}
            onClick={close}
            className="text-muted-foreground hover:text-foreground self-start truncate rounded-sm text-base hover:underline"
          >
            {track.artist.name}
          </Link>
        </div>

        <SeekBar />
        <TransportControls size="lg" />
        <div className="flex justify-center">
          <VolumeControl />
        </div>
      </SheetContent>
    </Sheet>
  );
}
