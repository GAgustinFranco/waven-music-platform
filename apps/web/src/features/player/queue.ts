/**
 * Pure queue logic behind `player.store`. The queue keeps the tracks in their
 * original order plus a play `order` (indexes into `tracks`): the identity when
 * shuffle is off, a permutation when it is on. `position` points into `order`.
 */

export type RepeatMode = 'off' | 'all' | 'one';

export const REPEAT_MODES: readonly RepeatMode[] = ['off', 'all', 'one'];

export interface QueueState {
  /** Track indexes in play order. */
  order: number[];
  /** Index into `order` of the current track. */
  position: number;
}

/** A random number in [0, 1), injectable so tests are deterministic. */
export type Rng = () => number;

export const identityOrder = (length: number): number[] => Array.from({ length }, (_, i) => i);

/**
 * Fisher–Yates over every track except `first`, which plays first. Each track
 * appears exactly once, so a shuffled pass never repeats a track.
 */
export function shuffleOrder(length: number, first: number, rng: Rng = Math.random): number[] {
  const rest = identityOrder(length).filter((index) => index !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j] as number, rest[i] as number];
  }
  return length > 0 ? [first, ...rest] : [];
}

/** Turning shuffle on keeps the current track and shuffles the rest after it. */
export function enableShuffle(state: QueueState, rng?: Rng): QueueState {
  const current = state.order[state.position] ?? 0;
  return { order: shuffleOrder(state.order.length, current, rng), position: 0 };
}

/** Turning shuffle off goes back to the original order, at the same track. */
export function disableShuffle(state: QueueState): QueueState {
  return { order: identityOrder(state.order.length), position: state.order[state.position] ?? 0 };
}

/**
 * Where playback goes next, or `null` when the queue is over.
 * `auto` is true when the track ended by itself: only then does repeat-one
 * replay it; pressing "next" always moves on.
 */
export function nextPosition(
  position: number,
  length: number,
  repeat: RepeatMode,
  auto: boolean,
): number | null {
  if (length === 0) {
    return null;
  }
  if (auto && repeat === 'one') {
    return position;
  }
  if (position + 1 < length) {
    return position + 1;
  }
  return repeat === 'off' ? null : 0;
}

/** "Previous" from the first track wraps only with repeat-all; otherwise it stays. */
export function previousPosition(position: number, length: number, repeat: RepeatMode): number {
  if (length === 0) {
    return 0;
  }
  if (position > 0) {
    return position - 1;
  }
  return repeat === 'all' ? length - 1 : 0;
}

export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  return REPEAT_MODES[(REPEAT_MODES.indexOf(mode) + 1) % REPEAT_MODES.length] ?? 'off';
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [item] = result.splice(from, 1);
  if (item === undefined) {
    return result;
  }
  result.splice(to, 0, item);
  return result;
}

/**
 * Moves an entry of the play order (`from` → `to`, both positions in `order`)
 * and keeps `position` on the same track. With shuffle off the caller moves the
 * tracks themselves, so the original order follows the user's reordering.
 */
export function movePosition(position: number, from: number, to: number): number {
  if (from === position) {
    return to;
  }
  if (from < position && to >= position) {
    return position - 1;
  }
  if (from > position && to <= position) {
    return position + 1;
  }
  return position;
}
