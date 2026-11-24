/** The Home hero designs, in the order they take turns. */
export const HERO_DESIGNS = ['wall', 'mosaic', 'float', 'flow', 'vinyl'] as const;

export type HeroDesign = (typeof HERO_DESIGNS)[number];

/** sessionStorage key with the design shown last, so a reload also moves on. */
export const HERO_STORAGE_KEY = 'waven-home-hero';

export const isHeroDesign = (value: unknown): value is HeroDesign =>
  typeof value === 'string' && (HERO_DESIGNS as readonly string[]).includes(value);

/**
 * The design for this visit to Home: the one after `previous`, so the same
 * design never shows twice in a row, or a random one on the first visit.
 * `requested` (`?hero=…`) forces one, which is handy to review them.
 */
export function nextHeroDesign(
  previous: string | null,
  requested: string | null = null,
  random: () => number = Math.random,
): HeroDesign {
  if (isHeroDesign(requested)) {
    return requested;
  }
  if (isHeroDesign(previous)) {
    return HERO_DESIGNS[(HERO_DESIGNS.indexOf(previous) + 1) % HERO_DESIGNS.length] ?? 'wall';
  }
  return HERO_DESIGNS[Math.floor(random() * HERO_DESIGNS.length)] ?? 'wall';
}

/** Storage may be disabled (private mode, blocked site data); the rotation then starts fresh. */
export function readLastHeroDesign(storage: Pick<Storage, 'getItem'> | undefined): string | null {
  try {
    return storage?.getItem(HERO_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeLastHeroDesign(
  storage: Pick<Storage, 'setItem'> | undefined,
  design: HeroDesign,
): void {
  try {
    storage?.setItem(HERO_STORAGE_KEY, design);
  } catch {
    // Without storage the next visit simply picks at random.
  }
}

/** Picks and remembers the design for a visit to Home. */
export function heroDesignForVisit(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  requested: string | null = null,
  random: () => number = Math.random,
): HeroDesign {
  const design = nextHeroDesign(readLastHeroDesign(storage), requested, random);
  writeLastHeroDesign(storage, design);
  return design;
}

/** Local greeting for the hero title. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }
  if (hour >= 12 && hour < 19) {
    return 'Good afternoon';
  }
  return 'Good evening';
}
