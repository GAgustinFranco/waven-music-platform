'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useSyncExternalStore } from 'react';
import { showcaseQuery } from '@/lib/api/catalog';
import { FloatingCovers } from './floating-covers';
import { MagneticMosaic } from './magnetic-mosaic';
import { MarqueeWall } from './marquee-wall';

export const BACKDROPS = {
  wall: MarqueeWall,
  mosaic: MagneticMosaic,
  float: FloatingCovers,
} as const;

export type BackdropName = keyof typeof BACKDROPS;

const NAMES = Object.keys(BACKDROPS) as BackdropName[];

export const isBackdropName = (value: string | null): value is BackdropName =>
  value !== null && value in BACKDROPS;

/** `?backdrop=wall|mosaic|float` picks one (handy to review them); otherwise it is random. */
function pickBackdrop(): BackdropName {
  const requested = new URLSearchParams(window.location.search).get('backdrop');
  if (isBackdropName(requested)) {
    return requested;
  }
  return NAMES[Math.floor(Math.random() * NAMES.length)] ?? 'wall';
}

const noopSubscribe = () => () => {};

/** Only renders in the browser, so the random pick never mismatches the server HTML. */
export function LoginBackdrop() {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return (
    <div aria-hidden="true" className="bg-background absolute inset-0">
      {isClient ? <RandomBackdrop /> : null}
    </div>
  );
}

function RandomBackdrop() {
  const [name] = useState(pickBackdrop);
  // Without covers (API down or an empty catalog) the backdrops keep their shape.
  const { data } = useQuery(showcaseQuery());
  const Backdrop = BACKDROPS[name];
  return (
    <div data-backdrop={name} className="absolute inset-0">
      <Backdrop covers={data?.covers ?? []} />
    </div>
  );
}
