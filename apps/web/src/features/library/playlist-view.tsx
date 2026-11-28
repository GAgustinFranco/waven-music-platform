'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, ListMusic, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  COVER_CLASS,
  COVER_SIZES,
  DominantHeader,
  DominantHeaderSkeleton,
} from '@/components/catalog/dominant-header';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { TrackList, TrackListSkeleton, TrackRow } from '@/components/catalog/track-row';
import { PlaylistCover } from '@/components/library/playlist-cover';
import { PlayCollectionButton } from '@/components/player/play-collection-button';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { NotFoundState } from '@/features/catalog/not-found-state';
import { isNotFound, isUuid, type Track } from '@/lib/api/catalog';
import { type PlaylistDetail, type PlaylistEntry, playlistQuery } from '@/lib/api/library';
import { formatTotalDuration, pluralize } from '@/lib/format';
import { type PlaySource, usePlayerStore } from '@/stores/player.store';
import { GhostMosaic } from './ghost-mosaic';
import { useMoveEntry, useRemoveEntry } from './mutations';
import { DeletePlaylistDialog, EditPlaylistDialog } from './playlist-dialogs';
import { useLikedSet } from './use-liked';

export function PlaylistView() {
  const { id } = useParams<{ id: string }>();
  const validId = isUuid(id);
  const ready = useSessionReady();
  const { data, isPending, isError, error, refetch, isRefetching } = useQuery({
    ...playlistQuery(id),
    enabled: ready && validId,
  });

  if (!validId || isNotFound(error)) {
    return <NotFoundState kind="playlist" />;
  }

  if (isPending) {
    return (
      <>
        <LoadingStatus label="Loading playlist" />
        <DominantHeaderSkeleton />
        <div className="px-gutter lg:px-gutter-lg pt-6">
          <TrackListSkeleton count={8} />
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <div className="px-gutter lg:px-gutter-lg pt-20">
        <ErrorState as="h1" onRetry={() => void refetch()} retrying={isRefetching} />
      </div>
    );
  }

  return <Playlist playlist={data} />;
}

function Playlist({ playlist }: { playlist: PlaylistDetail }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const playQueue = usePlayerStore((state) => state.playQueue);
  const source: PlaySource = { context: 'playlist', id: playlist.id };
  // Unavailable tracks are skipped by the player; each row maps to its place in the queue.
  const { tracks, queueIndex } = useMemo(() => {
    const playable: Track[] = [];
    const indexByEntry = new Map<string, number>();
    for (const entry of playlist.entries) {
      if (entry.available) {
        indexByEntry.set(entry.id, playable.length);
        playable.push(entry.track);
      }
    }
    return { tracks: playable, queueIndex: indexByEntry };
  }, [playlist.entries]);

  return (
    <>
      <title>{`${playlist.name} · Waven`}</title>
      <DominantHeader
        kind="Playlist"
        title={playlist.name}
        image={null}
        dominantColor={null}
        cover={
          <PlaylistCover
            covers={playlist.covers}
            sizes={COVER_SIZES}
            priority
            className={COVER_CLASS}
          />
        }
        play={
          tracks.length > 0 ? (
            <PlayCollectionButton tracks={tracks} source={source} label={playlist.name} size="sm" />
          ) : null
        }
      >
        {playlist.description ? (
          <p className="text-muted-foreground mb-1 line-clamp-2">{playlist.description}</p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-1.5">
          <span>{pluralize(playlist.entries.length, 'track')}</span>
          {tracks.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatTotalDuration(playlist.durationMs)}</span>
            </>
          ) : null}
        </p>
      </DominantHeader>

      <div className="px-gutter lg:px-gutter-lg flex flex-col gap-4 pt-6">
        <div className="flex items-center gap-2">
          {tracks.length > 0 ? (
            <PlayCollectionButton tracks={tracks} source={source} label={playlist.name} />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={`More options for ${playlist.name}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal aria-hidden="true" className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2 aria-hidden="true" />
                Delete playlist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {playlist.entries.length > 0 ? (
          <PlaylistEntries
            playlist={playlist}
            onPlay={(entry) => {
              const index = queueIndex.get(entry.id);
              if (index !== undefined) {
                playQueue(tracks, index, source);
              }
            }}
          />
        ) : (
          <EmptyState
            icon={ListMusic}
            backdrop={<GhostMosaic />}
            title="This playlist is empty"
            description="Add tracks from any album, artist or list with the “More options” menu of a track."
          >
            <Button asChild variant="secondary">
              <Link href="/">Find something to add</Link>
            </Button>
          </EmptyState>
        )}
      </div>

      <EditPlaylistDialog playlist={playlist} open={editing} onOpenChange={setEditing} />
      <DeletePlaylistDialog playlist={playlist} open={deleting} onOpenChange={setDeleting} />
    </>
  );
}

function PlaylistEntries({
  playlist,
  onPlay,
}: {
  playlist: PlaylistDetail;
  onPlay: (entry: PlaylistEntry) => void;
}) {
  const entries = playlist.entries;
  const move = useMoveEntry(playlist.id);
  const remove = useRemoveEntry(playlist.id);
  const liked = useLikedSet(entries.map((entry) => entry.track.id));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: string | number) =>
    entries.find((entry) => entry.id === id)?.track.title ?? 'track';
  const placeOf = (id: string | number) => entries.findIndex((entry) => entry.id === id) + 1;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const from = entries.findIndex((entry) => entry.id === active.id);
    const to = entries.findIndex((entry) => entry.id === over?.id);
    if (from >= 0 && to >= 0 && from !== to) {
      move.mutate(
        { entryId: String(active.id), from, to },
        { onError: () => toast.error("Couldn't reorder the playlist. Try again.") },
      );
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To reorder, press Space or Enter on the handle, move with the arrow keys, then press Space or Enter again to drop, or Escape to cancel.',
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Picked up ${titleOf(active.id)}, position ${placeOf(active.id)} of ${entries.length}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${titleOf(active.id)} moved to position ${placeOf(over.id)}.`
              : `${titleOf(active.id)} is outside the list.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `${titleOf(active.id)} dropped at position ${placeOf(over.id)}.`
              : `${titleOf(active.id)} dropped.`,
          onDragCancel: ({ active }) => `Reordering ${titleOf(active.id)} cancelled.`,
        },
      }}
    >
      <SortableContext
        items={entries.map((entry) => entry.id)}
        strategy={verticalListSortingStrategy}
      >
        <TrackList label={`${playlist.name} tracks`}>
          {entries.map((entry, index) => (
            <SortableEntry
              key={entry.id}
              entry={entry}
              position={index + 1}
              liked={liked?.has(entry.track.id)}
              onPlay={() => onPlay(entry)}
              onRemove={() =>
                remove.mutate(
                  { entryId: entry.id },
                  {
                    onSuccess: () =>
                      toast.success(`Removed ${entry.track.title} from ${playlist.name}`),
                    onError: () => toast.error("Couldn't remove the track. Try again."),
                  },
                )
              }
            />
          ))}
        </TrackList>
      </SortableContext>
    </DndContext>
  );
}

function SortableEntry({
  entry,
  position,
  liked,
  onPlay,
  onRemove,
}: {
  entry: PlaylistEntry;
  position: number;
  liked: boolean | undefined;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  return (
    <TrackRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      track={entry.track}
      position={position}
      showCover
      showAlbum
      unavailable={!entry.available}
      liked={liked}
      onPlay={onPlay}
      menuItems={
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <Trash2 aria-hidden="true" />
          Remove from this playlist
        </DropdownMenuItem>
      }
      handle={
        <Button
          ref={setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Reorder ${entry.track.title}`}
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" />
        </Button>
      }
    />
  );
}
