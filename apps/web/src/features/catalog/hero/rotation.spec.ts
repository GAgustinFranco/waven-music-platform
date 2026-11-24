import { describe, expect, it } from 'vitest';
import {
  greeting,
  HERO_DESIGNS,
  HERO_STORAGE_KEY,
  heroDesignForVisit,
  nextHeroDesign,
  readLastHeroDesign,
  writeLastHeroDesign,
} from './rotation';

describe('nextHeroDesign', () => {
  it('moves to the next design on every visit and wraps around', () => {
    expect(nextHeroDesign('wall')).toBe('mosaic');
    expect(nextHeroDesign('flow')).toBe('vinyl');
    expect(nextHeroDesign('vinyl')).toBe('wall');
  });

  it('never repeats the previous design', () => {
    for (const design of HERO_DESIGNS) {
      expect(nextHeroDesign(design)).not.toBe(design);
    }
  });

  it('picks at random on the first visit or with an unknown value', () => {
    expect(nextHeroDesign(null, null, () => 0)).toBe('wall');
    expect(nextHeroDesign(null, null, () => 0.99)).toBe('vinyl');
    expect(nextHeroDesign('equalizer', null, () => 0.5)).toBe('float');
  });

  it('honors a requested design', () => {
    expect(nextHeroDesign('wall', 'wall')).toBe('wall');
    expect(nextHeroDesign('wall', 'nope')).toBe('mosaic');
  });
});

describe('hero design storage', () => {
  it('round-trips the last design', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    writeLastHeroDesign(storage, 'float');
    expect(values.get(HERO_STORAGE_KEY)).toBe('float');
    expect(readLastHeroDesign(storage)).toBe('float');
  });

  it('survives storage that throws or is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readLastHeroDesign(broken)).toBeNull();
    expect(() => writeLastHeroDesign(broken, 'wall')).not.toThrow();
    expect(readLastHeroDesign(undefined)).toBeNull();
  });
});

describe('heroDesignForVisit', () => {
  it('moves on with every visit and remembers the design shown', () => {
    const values = new Map<string, string>([[HERO_STORAGE_KEY, 'wall']]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    expect(heroDesignForVisit(storage)).toBe('mosaic');
    expect(heroDesignForVisit(storage)).toBe('float');
    expect(values.get(HERO_STORAGE_KEY)).toBe('float');
  });
});

describe('greeting', () => {
  it('follows the time of day', () => {
    expect(greeting(8)).toBe('Good morning');
    expect(greeting(15)).toBe('Good afternoon');
    expect(greeting(21)).toBe('Good evening');
    expect(greeting(2)).toBe('Good evening');
  });
});
