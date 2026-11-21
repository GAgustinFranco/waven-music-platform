import { describe, expect, it } from 'vitest';
import { shortcutFor } from './shortcuts';

const key = (value: string, extra: Partial<Parameters<typeof shortcutFor>[0]> = {}) => ({
  key: value,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  defaultPrevented: false,
  repeat: false,
  ...extra,
});

describe('shortcutFor', () => {
  it('maps the player keys', () => {
    expect(shortcutFor(key(' '), 'other')).toBe('toggle-play');
    expect(shortcutFor(key('ArrowLeft'), 'other')).toBe('seek-back');
    expect(shortcutFor(key('ArrowRight'), 'other')).toBe('seek-forward');
    expect(shortcutFor(key('ArrowLeft', { shiftKey: true }), 'other')).toBe('previous');
    expect(shortcutFor(key('ArrowRight', { shiftKey: true }), 'other')).toBe('next');
    expect(shortcutFor(key('m'), 'other')).toBe('toggle-mute');
    expect(shortcutFor(key('S'), 'other')).toBe('toggle-shuffle');
    expect(shortcutFor(key('r'), 'other')).toBe('cycle-repeat');
  });

  it('never fires while typing', () => {
    for (const value of [' ', 'm', 's', 'r', 'ArrowLeft']) {
      expect(shortcutFor(key(value), 'text')).toBeNull();
    }
  });

  it('leaves Space to buttons and links, and arrows to sliders', () => {
    expect(shortcutFor(key(' '), 'control')).toBeNull();
    expect(shortcutFor(key('ArrowLeft'), 'control')).toBe('seek-back');
    expect(shortcutFor(key('ArrowRight'), 'slider')).toBeNull();
    expect(shortcutFor(key('m'), 'slider')).toBe('toggle-mute');
  });

  it('ignores browser shortcuts and handled or repeated keys', () => {
    expect(shortcutFor(key('r', { ctrlKey: true }), 'other')).toBeNull();
    expect(shortcutFor(key('s', { metaKey: true }), 'other')).toBeNull();
    expect(shortcutFor(key('ArrowLeft', { altKey: true }), 'other')).toBeNull();
    expect(shortcutFor(key(' ', { defaultPrevented: true }), 'other')).toBeNull();
    expect(shortcutFor(key(' ', { repeat: true }), 'other')).toBeNull();
    expect(shortcutFor(key('m', { repeat: true }), 'other')).toBeNull();
    expect(shortcutFor(key('ArrowRight', { repeat: true }), 'other')).toBe('seek-forward');
  });
});
