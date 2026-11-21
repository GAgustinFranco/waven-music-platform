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
import { GripVertical, ListMusic, Play } from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from 'cn';
import { CoverImage } from '@/components/catalog/cover-image';
import { Section } from '@/components/catalog/section';
import { EmptyState } from '@/components/catalog/states';
import { Button } from '@/components/ui/button';
import type { Track } from '@/lib/api/catalog';
import { describeDuration, formatDuration } from '@/lib/format';
import {
  type QueueSlice,
  selectCurrentTrack,
  selectUpcoming,
  usePlayerStore,
} from '@/stores/player.store';

interface QueueEntry {
  /** Stable across reorders, unique even if a track appears twice. */
  id: string;
  track: Track;
  position: number;
}

function entriesOf(state: QueueSlice): QueueEntry[] {
  const seen = new Map<string, number>();
  const idByIndex = state.tracks.map((track) => {
    const n = seen.get(track.id) ?? 0;
    seen.set(track.id, n + 1);
    return `${track.id}:${n}`;
  });
  return selectUpcoming(state).map(({ track, position }) => ({
    id: idByIndex[state.order[position] ?? -1] ?? `${track.id}:${position}`,
    track,
    position,
  }));
}

export function QueueView() {
  const current = usePlayerStore(selectCurrentTrack);
  const tracks = usePlayerStore((state) => state.tracks);
  const order = usePlayerStore((state) => state.order);
  const position = usePlayerStore((state) => state.position);
  const playAt = usePlayerStore((state) => state.playAt);
  const moveInQueue = usePlayerStore((state) => state.moveInQueue);
  const upcoming = entriesOf({ tracks, order, position });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: string | number) =>
    upcoming.find((entry) => entry.id === id)?.track.title ?? 'track';
  const placeOf = (id: string | number) => upcoming.findIndex((entry) => entry.id === id) + 1;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const from = upcoming.find((entry) => entry.id === active.id)?.position;
    const to = upcoming.find((entry) => entry.id === over?.id)?.position;
    if (from !== undefined && to !== undefined && from !== to) {
      moveInQueue(from, to);
    }
  };

  return (
    <div className="px-gutter lg:px-gutter-lg flex flex-col gap-8 pt-20">
      <h1 className="text-3xl font-bold tracking-tight">Queue</h1>

      {!current ? (
        <EmptyState
          icon={ListMusic}
          title="Your queue is empty"
          description="Play an album or a track and what comes next shows up here."
        >
          <Button asChild variant="secondary">
            <Link href="/">Browse music</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <Section id="now-playing" title="Now playing">
            <ol aria-label="Now playing">
              <QueueRow track={current} current />
            </ol>
          </Section>

          <Section id="next-up" title="Next up">
            {upcoming.length > 0 ? (
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
                      `Picked up ${titleOf(active.id)}, position ${placeOf(active.id)} of ${upcoming.length}.`,
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
                  items={upcoming.map((entry) => entry.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ol aria-label="Next up" className="flex flex-col">
                    {upcoming.map((entry) => (
                      <SortableQueueRow
                        key={entry.id}
                        entry={entry}
                        onPlay={() => playAt(entry.position)}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-muted-foreground text-sm">Nothing else is queued.</p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function SortableQueueRow({ entry, onPlay }: { entry: QueueEntry; onPlay: () => void }) {
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
    <QueueRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      track={entry.track}
      dragging={isDragging}
      onPlay={onPlay}
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

function QueueRow({
  ref,
  style,
  track,
  current = false,
  dragging = false,
  onPlay,
  handle,
}: {
  ref?: (node: HTMLLIElement | null) => void;
  style?: CSSProperties;
  track: Track;
  current?: boolean;
  dragging?: boolean;
  onPlay?: () => void;
  handle?: ReactNode;
}) {
  return (
    <li
      ref={ref}
      style={style}
      className={cn(
        'hover:bg-surface-2 relative grid grid-cols-[--spacing(8)_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-sm px-2 py-2 sm:px-4',
        dragging && 'bg-elevated z-10 shadow-lg',
      )}
    >
      <div className="flex justify-center">{handle}</div>
      <div className="flex min-w-0 items-center gap-3">
        <CoverImage image={track.album.cover} sizes="40px" className="size-10 shrink-0" />
        <div className="min-w-0">
          <p className={cn('truncate text-base font-medium', current && 'text-brand')}>
            {track.title}
          </p>
          <p className="text-muted-foreground truncate text-sm">{track.artist.name}</p>
        </div>
      </div>
      {onPlay ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Play ${track.title}`}
          onClick={onPlay}
          className="text-muted-foreground hover:text-foreground"
        >
          <Play aria-hidden="true" className="fill-current" />
        </Button>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground min-w-[5ch] text-right font-mono text-sm tabular-nums">
        <span aria-hidden="true">{formatDuration(track.durationMs)}</span>
        <span className="sr-only">{describeDuration(track.durationMs)}</span>
      </span>
    </li>
  );
}
