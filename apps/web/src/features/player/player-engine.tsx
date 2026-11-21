'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { catalogKeys } from '@/lib/api/catalog';
import { historyKeys } from '@/lib/api/history';
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
  const queryClient = useQueryClient();

  useEffect(() => audioEngine.start(), []);

  // A recorded play changes the history and Home's "Recently played".
  useEffect(
    () =>
      audioEngine.onPlayRecorded(() => {
        void queryClient.invalidateQueries({ queryKey: historyKeys.all });
        void queryClient.invalidateQueries({ queryKey: catalogKeys.home() });
      }),
    [queryClient],
  );

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
