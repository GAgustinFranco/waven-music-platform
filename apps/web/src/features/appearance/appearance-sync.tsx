'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { meQuery } from '@/lib/api/queries';
import {
  BACKDROP_OPTIONS,
  type Backdrop,
  glowFor,
  readableAccent,
  type Theme,
  THEME_OPTIONS,
} from '@/lib/theme';
import { useAuthStore } from '@/stores/auth.store';
import { selectCurrentTrack, usePlayerStore } from '@/stores/player.store';

const CACHE_KEY = 'waven-appearance';

interface CachedAppearance {
  theme: Theme;
  backdrop: Backdrop;
}

/** Reads the cached appearance, ignoring anything that is not a known theme. */
function readCachedAppearance(): CachedAppearance | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const { theme, backdrop } = parsed as Record<string, unknown>;
    const knownTheme = THEME_OPTIONS.find((option) => option.id === theme);
    const knownBackdrop = BACKDROP_OPTIONS.find((option) => option.id === backdrop);
    return knownTheme && knownBackdrop
      ? { theme: knownTheme.id, backdrop: knownBackdrop.id }
      : null;
  } catch {
    return null;
  }
}

function writeCachedAppearance(appearance: CachedAppearance): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(appearance));
  } catch {
    // Storage may be full or disabled; the theme still applies once /me loads.
  }
}

/**
 * Applies the effective appearance from `/me` to <html> (`data-theme`,
 * `data-backdrop`); the tokens in globals.css do the rest. With the Dynamic
 * theme the accent follows the dominant color of the album playing. Renders
 * nothing; leaving the app shell (admin, login) restores the default.
 */
export function AppearanceSync() {
  const status = useAuthStore((state) => state.status);
  const { data: me } = useQuery({ ...meQuery(), enabled: status === 'authenticated' });
  // The last appearance seen on this device, so a reload does not flash the default.
  const [cached] = useState(readCachedAppearance);
  const theme = me?.appearance.theme ?? cached?.theme ?? 'violet';
  const backdrop = me?.appearance.backdrop ?? cached?.backdrop ?? 'solid';

  useEffect(() => {
    if (me) {
      writeCachedAppearance(me.appearance);
    }
  }, [me]);
  // Queues saved before covers carried a color have no `dominantColor`.
  const albumColor = usePlayerStore((state) => selectCurrentTrack(state)?.album.dominantColor);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'violet') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }
    if (backdrop === 'solid') {
      delete root.dataset.backdrop;
    } else {
      root.dataset.backdrop = backdrop;
    }
    return () => {
      delete root.dataset.theme;
      delete root.dataset.backdrop;
    };
  }, [theme, backdrop]);

  useEffect(() => {
    const root = document.documentElement;
    const accent = theme === 'dynamic' ? readableAccent(albumColor) : null;
    if (accent) {
      root.style.setProperty('--dynamic-accent', accent);
      root.style.setProperty('--dynamic-glow', glowFor(accent));
    } else {
      root.style.removeProperty('--dynamic-accent');
      root.style.removeProperty('--dynamic-glow');
    }
    return () => {
      root.style.removeProperty('--dynamic-accent');
      root.style.removeProperty('--dynamic-glow');
    };
  }, [theme, albumColor]);

  return null;
}
