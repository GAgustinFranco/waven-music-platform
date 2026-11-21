import { describe, expect, it } from 'vitest';
import {
  disableShuffle,
  enableShuffle,
  moveItem,
  movePosition,
  nextPosition,
  nextRepeatMode,
  previousPosition,
  shuffleOrder,
} from './queue';

/** A deterministic RNG (mulberry32) so shuffles are reproducible. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('shuffleOrder', () => {
  it('starts with the chosen track and contains every track exactly once', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const order = shuffleOrder(12, 7, seeded(seed));

      expect(order[0]).toBe(7);
      expect(order).toHaveLength(12);
      expect(new Set(order).size).toBe(12);
      expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  });

  it('actually changes the order', () => {
    const order = shuffleOrder(20, 0, seeded(42));

    expect(order).not.toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('handles empty and single-track queues', () => {
    expect(shuffleOrder(0, 0)).toEqual([]);
    expect(shuffleOrder(1, 0)).toEqual([0]);
  });
});

describe('enableShuffle / disableShuffle', () => {
  it('keeps the current track playing when shuffle is toggled on and off', () => {
    const shuffled = enableShuffle({ order: [0, 1, 2, 3, 4], position: 3 }, seeded(7));

    expect(shuffled.position).toBe(0);
    expect(shuffled.order[0]).toBe(3);

    const advanced = { ...shuffled, position: 2 };
    const current = advanced.order[2];
    const restored = disableShuffle(advanced);

    expect(restored.order).toEqual([0, 1, 2, 3, 4]);
    expect(restored.position).toBe(current);
  });
});

describe('nextPosition', () => {
  it('advances through the queue and stops at the end with repeat off', () => {
    expect(nextPosition(0, 3, 'off', false)).toBe(1);
    expect(nextPosition(1, 3, 'off', true)).toBe(2);
    expect(nextPosition(2, 3, 'off', true)).toBeNull();
    expect(nextPosition(2, 3, 'off', false)).toBeNull();
  });

  it('wraps to the start with repeat all', () => {
    expect(nextPosition(2, 3, 'all', true)).toBe(0);
    expect(nextPosition(2, 3, 'all', false)).toBe(0);
  });

  it('replays the track when it ends with repeat one, but "next" still moves on', () => {
    expect(nextPosition(1, 3, 'one', true)).toBe(1);
    expect(nextPosition(1, 3, 'one', false)).toBe(2);
    expect(nextPosition(2, 3, 'one', false)).toBe(0);
  });

  it('has nowhere to go in an empty queue', () => {
    expect(nextPosition(0, 0, 'all', true)).toBeNull();
  });
});

describe('previousPosition', () => {
  it('goes back one track, staying on the first unless repeat all wraps', () => {
    expect(previousPosition(2, 3, 'off')).toBe(1);
    expect(previousPosition(0, 3, 'off')).toBe(0);
    expect(previousPosition(0, 3, 'one')).toBe(0);
    expect(previousPosition(0, 3, 'all')).toBe(2);
  });
});

describe('nextRepeatMode', () => {
  it('cycles off → all → one → off', () => {
    expect(nextRepeatMode('off')).toBe('all');
    expect(nextRepeatMode('all')).toBe('one');
    expect(nextRepeatMode('one')).toBe('off');
  });
});

describe('moveItem / movePosition', () => {
  it('moves an item without losing any', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('keeps the current position on the same item', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const current = 2;
    for (let from = 0; from < items.length; from++) {
      for (let to = 0; to < items.length; to++) {
        const moved = moveItem(items, from, to);
        expect(moved[movePosition(current, from, to)]).toBe(items[current]);
      }
    }
  });
});
