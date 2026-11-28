import { describe, expect, it } from 'vitest';
import { type ActivationStore, activationKey, claimActivation } from './activation';

function memoryStore(): ActivationStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('claimActivation', () => {
  it('plays the first time and records it', () => {
    const store = memoryStore();
    expect(claimActivation(store, 'sub-1')).toBe(true);
    expect(store.values.has(activationKey('sub-1'))).toBe(true);
  });

  it('skips a subscription it already celebrated', () => {
    const store = memoryStore();
    claimActivation(store, 'sub-1');
    expect(claimActivation(store, 'sub-1')).toBe(false);
  });

  it('plays again for a new subscription', () => {
    const store = memoryStore();
    claimActivation(store, 'sub-1');
    expect(claimActivation(store, 'sub-2')).toBe(true);
  });

  it('still plays when storage throws', () => {
    const store: ActivationStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(claimActivation(store, 'sub-1')).toBe(true);
  });
});
