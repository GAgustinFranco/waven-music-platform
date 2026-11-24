/** Color themes. Only the colors change; type, spacing and layout are shared. */
export enum Theme {
  Violet = 'violet',
  Dynamic = 'dynamic',
  Ocean = 'ocean',
  Ember = 'ember',
  Rose = 'rose',
  Aurora = 'aurora',
  Sunset = 'sunset',
  Mono = 'mono',
}

/**
 * What sits behind the content: a flat color, a soft light in the theme's color,
 * or slow drifting lights in the theme's colors (Ambient).
 */
export enum Backdrop {
  Solid = 'solid',
  Glow = 'glow',
  Ambient = 'ambient',
}

export interface Appearance {
  theme: Theme;
  backdrop: Backdrop;
}

/** Waven's own look, and the only one on the Free plan. */
export const DEFAULT_APPEARANCE: Readonly<Appearance> = {
  theme: Theme.Violet,
  backdrop: Backdrop.Solid,
};

export function isDefaultAppearance(appearance: Appearance): boolean {
  return (
    appearance.theme === DEFAULT_APPEARANCE.theme &&
    appearance.backdrop === DEFAULT_APPEARANCE.backdrop
  );
}

/**
 * The appearance the app shows. A Free user always gets the default; the stored
 * choice is kept, so it comes back if they return to Premium.
 */
export function effectiveAppearance(stored: Appearance, premium: boolean): Appearance {
  return premium ? { theme: stored.theme, backdrop: stored.backdrop } : { ...DEFAULT_APPEARANCE };
}
