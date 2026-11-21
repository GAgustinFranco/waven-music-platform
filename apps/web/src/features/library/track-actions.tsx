'use client';

import { useQuery } from '@tanstack/react-query';
import { Heart, ListMusic, MoreHorizontal, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSessionReady } from '@/features/auth/use-session-ready';
import type { Track } from '@/lib/api/catalog';
import { DURATION } from '@/lib/motion';
import { myPlaylistsQuery } from '@/lib/api/library';
import { useLibrary } from './library-provider';
import { useAddToPlaylist, useToggleFavorite } from './mutations';

export function LikeButton({ track, liked }: { track: Track; liked: boolean }) {
  const toggle = useToggleFavorite();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={liked}
      aria-label={
        liked ? `Remove ${track.title} from Liked Songs` : `Save ${track.title} to Liked Songs`
      }
      onClick={() =>
        toggle.mutate(
          { trackId: track.id, liked: !liked },
          {
            onError: () => toast.error("Couldn't update Liked Songs. Try again."),
          },
        )
      }
      className={cn(
        liked ? 'text-brand hover:text-brand-hover' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {/* A short pop when a song is liked; skipped on mount and under reduced motion. */}
      <motion.span
        className="flex"
        initial={false}
        animate={liked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ duration: DURATION.panel }}
      >
        <Heart aria-hidden="true" className={cn(liked && 'fill-current')} />
      </motion.span>
    </Button>
  );
}

interface TrackMenuProps {
  track: Track;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extra items for this list, e.g. "Remove from this playlist". */
  children?: ReactNode;
}

/** The "…" menu of a track row; right-clicking the row opens it too. */
export function TrackMenu({ track, open, onOpenChange, children }: TrackMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`More options for ${track.title}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Plus aria-hidden="true" />
            Add to playlist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            {open ? <PlaylistChoices track={track} /> : null}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {children ? (
          <>
            <DropdownMenuSeparator />
            {children}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlaylistChoices({ track }: { track: Track }) {
  const ready = useSessionReady();
  const { data, isPending, isError } = useQuery({ ...myPlaylistsQuery(), enabled: ready });
  const add = useAddToPlaylist();
  const { createPlaylist } = useLibrary();

  return (
    <>
      <DropdownMenuItem onSelect={() => createPlaylist({ trackIds: [track.id], navigate: false })}>
        <Plus aria-hidden="true" />
        New playlist
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {isPending ? <DropdownMenuItem disabled>Loading playlists…</DropdownMenuItem> : null}
      {isError ? <DropdownMenuItem disabled>Couldn&apos;t load playlists</DropdownMenuItem> : null}
      {data?.items.length === 0 ? (
        <DropdownMenuItem disabled>No playlists yet</DropdownMenuItem>
      ) : null}
      {data?.items.map((playlist) => (
        <DropdownMenuItem
          key={playlist.id}
          onSelect={() =>
            add.mutate(
              { playlistId: playlist.id, trackIds: [track.id] },
              {
                onSuccess: () => toast.success(`Added to ${playlist.name}`),
                onError: () => toast.error(`Couldn't add to ${playlist.name}. Try again.`),
              },
            )
          }
        >
          <ListMusic aria-hidden="true" />
          <span className="truncate">{playlist.name}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
