import { createStore, useStore } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  disableShuffle,
  enableShuffle,
  identityOrder,
  moveItem,
  movePosition,
  nextPosition,
  nextRepeatMode,
  previousPosition,
  type RepeatMode,
  type Rng,
  shuffleOrder,
} from '@/features/player/queue';
import type { Track } from '@/lib/api/catalog';
import type { PlayContext } from '@/lib/api/player';

/** What started the queue: drives the header play buttons and the history context. */
export interface PlaySource {
  context: PlayContext;
  /** The album, artist or playlist id; null for mixed lists (home, search). */
  id: string | null;
}

/** "Previous" restarts the track instead when it has played longer than this. */
export const RESTART_THRESHOLD_MS = 3_000;

interface PersistedPlayerState {
  /** Tracks in their original order. */
  tracks: Track[];
  /** Play order: indexes into `tracks`. */
  order: number[];
  /** Index into `order`. */
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** 0–1. */
  volume: number;
  muted: boolean;
  source: PlaySource | null;
}

export interface PlayerState extends PersistedPlayerState {
  isPlaying: boolean;
  /**
   * Bumped whenever the current track must start again from 0 (new queue,
   * next, previous, repeat-one). The audio engine reloads when it changes.
   */
  playbackKey: number;
  /** Playback position, mirrored by the engine; never persisted. */
  currentTimeMs: number;
  durationMs: number;
  buffering: boolean;
  /** A playback failure the UI shows; cleared by the next track. */
  error: string | null;

  playQueue: (tracks: Track[], startIndex: number, source: PlaySource) => void;
  /** Jumps to a position of the play order (queue view). */
  playAt: (position: number) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  next: (options?: { auto?: boolean }) => void;
  previous: () => void;
  toggleShuffle: (rng?: Rng) => void;
  cycleRepeat: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  /** Reorders the play order; `from` and `to` are positions in it. */
  moveInQueue: (from: number, to: number) => void;
  setProgress: (currentTimeMs: number, durationMs?: number) => void;
  setBuffering: (buffering: boolean) => void;
  setError: (error: string | null) => void;
}

const initialPersisted: PersistedPlayerState = {
  tracks: [],
  order: [],
  position: 0,
  shuffle: false,
  repeat: 'off',
  volume: 0.8,
  muted: false,
  source: null,
};

const clampVolume = (volume: number) => Math.min(1, Math.max(0, volume));

/** Rejects a corrupted or outdated saved queue instead of crashing the player. */
function isValidQueue(state: Partial<PersistedPlayerState>): boolean {
  const { tracks, order, position } = state;
  if (!Array.isArray(tracks) || !Array.isArray(order) || typeof position !== 'number') {
    return false;
  }
  const sorted = [...order].sort((a, b) => a - b);
  return (
    order.length === tracks.length &&
    sorted.every((value, index) => value === index) &&
    (tracks.length === 0 || (position >= 0 && position < tracks.length))
  );
}

export const STORAGE_KEY = 'waven-player';

/**
 * `persist` writes on every update, including progress ticks that do not touch
 * the persisted slice; skipping identical values avoids rewriting the queue.
 */
function skipUnchangedWrites(raw: StateStorage): StateStorage {
  let last: string | null = null;
  return {
    getItem: (name) => raw.getItem(name),
    setItem: (name, value) => {
      if (value === last) {
        return;
      }
      last = value;
      return raw.setItem(name, value);
    },
    removeItem: (name) => raw.removeItem(name),
  };
}

export function createPlayerStore(storage?: StateStorage) {
  return createStore<PlayerState>()(
    persist(
      (set, get) => {
        /** Starts `position` from 0, keeping the play/pause state unless told otherwise. */
        const startAt = (position: number, isPlaying = get().isPlaying) =>
          set((state) => ({
            position,
            isPlaying,
            playbackKey: state.playbackKey + 1,
            currentTimeMs: 0,
            error: null,
          }));

        return {
          ...initialPersisted,
          isPlaying: false,
          playbackKey: 0,
          currentTimeMs: 0,
          durationMs: 0,
          buffering: false,
          error: null,

          playQueue: (tracks, startIndex, source) => {
            if (tracks.length === 0) {
              return;
            }
            const start = Math.min(Math.max(0, startIndex), tracks.length - 1);
            const { shuffle } = get();
            set({
              tracks: [...tracks],
              order: shuffle ? shuffleOrder(tracks.length, start) : identityOrder(tracks.length),
              source,
              durationMs: tracks[start]?.durationMs ?? 0,
            });
            startAt(shuffle ? 0 : start, true);
          },

          playAt: (position) => {
            if (position >= 0 && position < get().order.length) {
              startAt(position, true);
            }
          },

          togglePlay: () => get().setPlaying(!get().isPlaying),

          setPlaying: (playing) => {
            if (get().tracks.length > 0) {
              set({ isPlaying: playing });
            }
          },

          next: ({ auto = false } = {}) => {
            const { position, order, repeat } = get();
            const target = nextPosition(position, order.length, repeat, auto);
            if (target === null) {
              // The queue is over: back to the first track, paused.
              startAt(0, false);
              return;
            }
            startAt(target);
          },

          previous: () => {
            const { position, order, repeat, currentTimeMs } = get();
            if (currentTimeMs > RESTART_THRESHOLD_MS) {
              startAt(position);
              return;
            }
            startAt(previousPosition(position, order.length, repeat));
          },

          toggleShuffle: (rng) =>
            set((state) => {
              if (state.shuffle) {
                return { shuffle: false, ...disableShuffle(state) };
              }
              return { shuffle: true, ...enableShuffle(state, rng) };
            }),

          cycleRepeat: () => set((state) => ({ repeat: nextRepeatMode(state.repeat) })),

          setVolume: (volume) => {
            const value = clampVolume(volume);
            set({ volume: value, muted: value === 0 });
          },

          toggleMute: () =>
            set((state) =>
              // Unmuting at volume 0 would stay silent: bring it back to a usable level.
              state.muted && state.volume === 0
                ? { muted: false, volume: initialPersisted.volume }
                : { muted: !state.muted },
            ),

          moveInQueue: (from, to) =>
            set((state) => {
              const length = state.order.length;
              if (from === to || from < 0 || to < 0 || from >= length || to >= length) {
                return state;
              }
              const position = movePosition(state.position, from, to);
              if (state.shuffle) {
                return { order: moveItem(state.order, from, to), position };
              }
              // Unshuffled, the order is the identity: move the tracks themselves.
              return { tracks: moveItem(state.tracks, from, to), position };
            }),

          setProgress: (currentTimeMs, durationMs) =>
            set(durationMs === undefined ? { currentTimeMs } : { currentTimeMs, durationMs }),

          setBuffering: (buffering) => set({ buffering }),

          setError: (error) => set({ error }),
        };
      },
      {
        name: STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => skipUnchangedWrites(storage ?? localStorage)),
        // ARCHITECTURE §3: everything but the playback position (and runtime state).
        partialize: ({ tracks, order, position, shuffle, repeat, volume, muted, source }) => ({
          tracks,
          order,
          position,
          shuffle,
          repeat,
          volume,
          muted,
          source,
        }),
        merge: (persisted, current) => {
          const saved = (persisted ?? {}) as Partial<PersistedPlayerState>;
          const queue = isValidQueue(saved)
            ? {
                tracks: saved.tracks ?? [],
                order: saved.order ?? [],
                position: saved.position ?? 0,
                source: saved.source ?? null,
              }
            : {};
          const track = queue.tracks?.[queue.order?.[queue.position ?? 0] ?? 0];
          return {
            ...current,
            ...queue,
            shuffle: saved.shuffle ?? current.shuffle,
            repeat: saved.repeat ?? current.repeat,
            volume: clampVolume(saved.volume ?? current.volume),
            muted: saved.muted ?? current.muted,
            durationMs: track?.durationMs ?? 0,
          };
        },
        // Hydrated from the engine after mount, so the server render and the
        // first client render match.
        skipHydration: true,
      },
    ),
  );
}

export type PlayerStore = ReturnType<typeof createPlayerStore>;

export const playerStore = createPlayerStore();

export function usePlayerStore<T>(selector: (state: PlayerState) => T): T {
  return useStore(playerStore, selector);
}

export const selectCurrentTrack = (state: PlayerState): Track | null =>
  state.tracks[state.order[state.position] ?? -1] ?? null;

/** Tracks after the current one, in play order, with their position in it. */
export type QueueSlice = Pick<PlayerState, 'tracks' | 'order' | 'position'>;

export function selectUpcoming(state: QueueSlice): { track: Track; position: number }[] {
  return state.order.flatMap((trackIndex, position) => {
    const track = state.tracks[trackIndex];
    return position > state.position && track ? [{ track, position }] : [];
  });
}
