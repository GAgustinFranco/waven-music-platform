'use client';

import { useEffect, useState } from 'react';
import { playerStore } from '@/stores/player.store';

const REPEAT_MESSAGE = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat one track' } as const;

/**
 * Speaks mode changes for screen readers, since the keyboard shortcuts
 * (M, S, R) change them without moving focus to the buttons.
 */
export function PlayerAnnouncer() {
  const [message, setMessage] = useState('');

  useEffect(
    () =>
      playerStore.subscribe((state, prev) => {
        // Restoring the saved state on load changes everything at once: stay quiet.
        if (state.tracks !== prev.tracks && state.playbackKey === prev.playbackKey) {
          return;
        }
        if (state.shuffle !== prev.shuffle) {
          setMessage(state.shuffle ? 'Shuffle on' : 'Shuffle off');
        } else if (state.repeat !== prev.repeat) {
          setMessage(REPEAT_MESSAGE[state.repeat]);
        } else if (state.muted !== prev.muted) {
          setMessage(state.muted ? 'Muted' : 'Unmuted');
        }
      }),
    [],
  );

  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
