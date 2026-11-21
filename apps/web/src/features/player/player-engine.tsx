'use client';

import { useEffect } from 'react';
import { playerStore } from '@/stores/player.store';
import { audioEngine } from './audio-engine';
import { focusKind, KEYBOARD_SEEK_MS, type PlayerShortcut, shortcutFor } from './shortcuts';

function run(shortcut: PlayerShortcut): void {
  const state = playerStore.getState();
  switch (shortcut) {
    case 'toggle-play':
      return state.togglePlay();
    case 'seek-back':
      return audioEngine.seekBy(-KEYBOARD_SEEK_MS);
    case 'seek-forward':
      return audioEngine.seekBy(KEYBOARD_SEEK_MS);
    case 'previous':
      return state.previous();
    case 'next':
      return state.next();
    case 'toggle-mute':
      return state.toggleMute();
    case 'toggle-shuffle':
      return state.toggleShuffle();
    case 'cycle-repeat':
      return state.cycleRepeat();
  }
}

/** Starts the audio engine and the global keyboard shortcuts. Renders nothing. */
export function PlayerEngine() {
  useEffect(() => audioEngine.start(), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (playerStore.getState().tracks.length === 0) {
        return;
      }
      const shortcut = shortcutFor(event, focusKind(document.activeElement));
      if (shortcut) {
        event.preventDefault();
        run(shortcut);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
