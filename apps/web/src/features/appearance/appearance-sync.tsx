'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { meQuery } from '@/lib/api/queries';
import { coverColor } from '@/lib/cover-color';
import { type DynamicPalette, dynamicPalette } from '@/lib/palette';
import { BACKDROP_OPTIONS, type Backdrop, type Theme, THEME_OPTIONS } from '@/lib/theme';
import { useAuthStore } from '@/stores/auth.store';
import { selectCurrentTrack, usePlayerStore } from '@/stores/player.store';

const CACHE_KEY = 'waven-appearance';

/** The CSS custom properties globals.css reads for the Dynamic theme. */
const DYNAMIC_VARS: Record<keyof DynamicPalette, string> = {
  bg: '--dynamic-bg',
  surface: '--dynamic-surface',
  surface2: '--dynamic-surface-2',
  elevated: '--dynamic-elevated',
  border: '--dynamic-border',
  borderStrong: '--dynamic-border-strong',
  textMuted: '--dynamic-text-muted',
  accent: '--dynamic-accent',
  accentHover: '--dynamic-accent-hover',
  accent2: '--dynamic-accent-2',
  glow: '--dynamic-glow',
};

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
 * theme the whole palette (surfaces, borders, accent and glow) is derived from
 * the most vibrant color of the cover playing. Renders nothing; leaving the app
 * shell (admin, login) restores the default.
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
  const album = usePlayerStore((state) => selectCurrentTrack(state)?.album);
  const coverUrl = album?.cover?.sm;
  // Queues saved before covers carried a color have no `dominantColor`.
  const fallbackColor = album?.dominantColor;

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
    const clear = () => {
      for (const name of Object.values(DYNAMIC_VARS)) {
        root.style.removeProperty(name);
      }
    };
    if (theme !== 'dynamic') {
      clear();
      return clear;
    }
    let cancelled = false;
    void coverColor(coverUrl, fallbackColor).then((color) => {
      if (cancelled) {
        return;
      }
      if (!color) {
        clear();
        return;
      }
      const palette = dynamicPalette(color);
      for (const [key, value] of Object.entries(palette)) {
        root.style.setProperty(DYNAMIC_VARS[key as keyof DynamicPalette], value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [theme, coverUrl, fallbackColor]);

  // Leaving the app shell (admin, login) drops the Dynamic colors.
  useEffect(
    () => () => {
      const root = document.documentElement;
      for (const name of Object.values(DYNAMIC_VARS)) {
        root.style.removeProperty(name);
      }
    },
    [],
  );

  return null;
}
