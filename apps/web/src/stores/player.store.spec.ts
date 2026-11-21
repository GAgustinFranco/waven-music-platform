import { describe, expect, it } from 'vitest';
import type { StateStorage } from 'zustand/middleware';
import type { Track } from '@/lib/api/catalog';
import {
  createPlayerStore,
  RESTART_THRESHOLD_MS,
  selectCurrentTrack,
  selectUpcoming,
  STORAGE_KEY,
} from './player.store';

function makeTrack(n: number): Track {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    title: `Track ${n}`,
    trackNumber: n,
    durationMs: 180_000,
    artist: { id: 'artist-1', name: 'Artist' },
    album: { id: 'album-1', title: 'Album', cover: null },
    license: null,
    attributionUrl: null,
  } as Track;
}

const tracks = Array.from({ length: 5 }, (_, i) => makeTrack(i + 1));
const album = { context: 'album', id: 'album-1' } as const;

function memoryStorage(): StateStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => void data.set(name, value),
    removeItem: (name) => void data.delete(name),
  };
}

async function setup(storage = memoryStorage()) {
  const store = createPlayerStore(storage);
  await store.persist.rehydrate();
  return { store, storage, current: () => selectCurrentTrack(store.getState())?.title };
}

describe('player.store queue', () => {
  it('plays an album from the chosen track and walks it in order', async () => {
    const { store, current } = await setup();

    store.getState().playQueue(tracks, 1, album);
    expect(current()).toBe('Track 2');
    expect(store.getState().isPlaying).toBe(true);

    store.getState().next();
    store.getState().next();
    expect(current()).toBe('Track 4');
    expect(selectUpcoming(store.getState()).map(({ track }) => track.title)).toEqual(['Track 5']);

    store.getState().previous();
    expect(current()).toBe('Track 3');
  });

  it('bumps playbackKey on every track change, even to the same track', async () => {
    const { store } = await setup();
    store.getState().playQueue(tracks, 0, album);
    const key = store.getState().playbackKey;

    store.getState().next();
    store.getState().setProgress(RESTART_THRESHOLD_MS + 1);
    store.getState().previous();

    expect(store.getState().playbackKey).toBe(key + 2);
  });

  it('restarts the track on "previous" after 3 s instead of going back', async () => {
    const { store, current } = await setup();
    store.getState().playQueue(tracks, 2, album);

    store.getState().setProgress(RESTART_THRESHOLD_MS + 500);
    store.getState().previous();

    expect(current()).toBe('Track 3');
    expect(store.getState().currentTimeMs).toBe(0);
  });

  it('goes back to the first track, paused, when the queue ends with repeat off', async () => {
    const { store, current } = await setup();
    store.getState().playQueue(tracks, 4, album);

    store.getState().next({ auto: true });

    expect(current()).toBe('Track 1');
    expect(store.getState().isPlaying).toBe(false);
  });

  it('reorders the upcoming tracks and keeps the current one', async () => {
    const { store, current } = await setup();
    store.getState().playQueue(tracks, 1, album);

    store.getState().moveInQueue(4, 2);

    expect(current()).toBe('Track 2');
    expect(selectUpcoming(store.getState()).map(({ track }) => track.title)).toEqual([
      'Track 5',
      'Track 3',
      'Track 4',
    ]);
  });
});

describe('player.store repeat modes', () => {
  it('cycles off → all → one → off', async () => {
    const { store } = await setup();

    const modes = [store.getState().repeat];
    for (let i = 0; i < 3; i++) {
      store.getState().cycleRepeat();
      modes.push(store.getState().repeat);
    }

    expect(modes).toEqual(['off', 'all', 'one', 'off']);
  });

  it('repeat all wraps around in both directions', async () => {
    const { store, current } = await setup();
    store.getState().playQueue(tracks, 4, album);
    store.getState().cycleRepeat();

    store.getState().next({ auto: true });
    expect(current()).toBe('Track 1');
    expect(store.getState().isPlaying).toBe(true);

    store.getState().previous();
    expect(current()).toBe('Track 5');
  });

  it('repeat one replays the track when it ends, but "next" skips it', async () => {
    const { store, current } = await setup();
    store.getState().playQueue(tracks, 2, album);
    store.getState().cycleRepeat();
    store.getState().cycleRepeat();
    const key = store.getState().playbackKey;

    store.getState().next({ auto: true });
    expect(current()).toBe('Track 3');
    expect(store.getState().playbackKey).toBe(key + 1);

    store.getState().next();
    expect(current()).toBe('Track 4');
  });
});

describe('player.store shuffle', () => {
  it('plays every track exactly once per pass, starting with the current one', async () => {
    const { store, current } = await setup();
    store.getState().playQueue(tracks, 2, album);

    store.getState().toggleShuffle();
    const played = [current()];
    for (let i = 1; i < tracks.length; i++) {
      store.getState().next({ auto: true });
      played.push(current());
    }

    expect(played[0]).toBe('Track 3');
    expect(new Set(played).size).toBe(tracks.length);
  });

  it('starts a new queue shuffled when shuffle is already on', async () => {
    const { store, current } = await setup();
    store.getState().toggleShuffle();

    store.getState().playQueue(tracks, 3, album);

    expect(store.getState().position).toBe(0);
    expect(current()).toBe('Track 4');
    expect(new Set(store.getState().order).size).toBe(tracks.length);
  });

  it('returns to the original order at the same track when turned off', async () => {
    const { store, current } = await setup();
    store.getState().playQueue(tracks, 0, album);
    store.getState().toggleShuffle(() => 0.5);
    store.getState().next();
    const playing = current();

    store.getState().toggleShuffle();

    expect(current()).toBe(playing);
    expect(store.getState().order).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('player.store volume', () => {
  it('clamps the volume and treats 0 as muted', async () => {
    const { store } = await setup();

    store.getState().setVolume(1.5);
    expect(store.getState().volume).toBe(1);

    store.getState().setVolume(0);
    expect(store.getState().muted).toBe(true);

    store.getState().toggleMute();
    expect(store.getState()).toMatchObject({ muted: false, volume: 0.8 });
  });
});

describe('player.store persistence', () => {
  it('restores the queue, modes and volume on reload, but not the position or play state', async () => {
    const first = await setup();
    first.store.getState().playQueue(tracks, 3, album);
    first.store.getState().cycleRepeat();
    first.store.getState().setVolume(0.35);
    first.store.getState().setProgress(42_000);

    const reloaded = await setup(first.storage);

    expect(reloaded.current()).toBe('Track 4');
    expect(reloaded.store.getState()).toMatchObject({
      repeat: 'all',
      volume: 0.35,
      muted: false,
      source: album,
      isPlaying: false,
      currentTimeMs: 0,
    });
    expect(reloaded.store.getState().tracks).toHaveLength(tracks.length);
  });

  it('does not rewrite storage on progress updates', async () => {
    const { store, storage } = await setup();
    store.getState().playQueue(tracks, 0, album);
    const saved = storage.data.get(STORAGE_KEY);
    let writes = 0;
    const setItem = storage.setItem;
    storage.setItem = (name, value) => {
      writes++;
      return setItem(name, value);
    };

    store.getState().setProgress(1_000);
    store.getState().setProgress(2_000);

    expect(storage.data.get(STORAGE_KEY)).toBe(saved);
    expect(writes).toBe(0);
  });

  it('ignores a corrupted saved queue but keeps the volume', async () => {
    const storage = memoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { tracks: [makeTrack(1)], order: [0, 0], position: 9, volume: 0.2 },
        version: 1,
      }),
    );

    const { store } = await setup(storage);

    expect(store.getState().tracks).toEqual([]);
    expect(store.getState().volume).toBe(0.2);
  });
});
