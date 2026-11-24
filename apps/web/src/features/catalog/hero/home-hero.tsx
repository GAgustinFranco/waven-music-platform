'use client';

import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { type ComponentType, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CoverImage } from '@/components/catalog/cover-image';
import { usePointer } from '@/features/auth/backdrop/shared';
import { useSessionReady } from '@/features/auth/use-session-ready';
import { type ImageSet, showcaseQuery } from '@/lib/api/catalog';
import { meQuery } from '@/lib/api/queries';
import { HeroFlow } from './hero-flow';
import { HeroFloat } from './hero-float';
import { HeroMosaic } from './hero-mosaic';
import type { HeroDesignProps } from './hero-shared';
import { HeroVinyl } from './hero-vinyl';
import { HeroWall } from './hero-wall';
import { greeting, type HeroDesign, heroDesignForVisit } from './rotation';

const DESIGNS: Record<HeroDesign, ComponentType<HeroDesignProps>> = {
  wall: HeroWall,
  mosaic: HeroMosaic,
  float: HeroFloat,
  flow: HeroFlow,
  vinyl: HeroVinyl,
};

export interface HeroPick {
  id: string;
  title: string;
  cover: ImageSet | null;
}

const noopSubscribe = () => () => {};
const greetingNow = () => greeting(new Date().getHours());

/**
 * The top of Home: a greeting over an animated cover backdrop. Five designs
 * take turns, one per visit to Home (see rotation.ts). The backdrop is
 * decorative and client only; it pauses off screen and stands still under
 * prefers-reduced-motion. A mask fades it into whatever is behind the page
 * (Solid, Soft glow or Ambient), so the text always sits on the page color.
 */
export function HomeHero({ picks, resume }: { picks: readonly HeroPick[]; resume: boolean }) {
  const ready = useSessionReady();
  const { data: me } = useQuery({ ...meQuery(), enabled: ready });
  const firstName = me?.displayName.trim().split(/\s+/)[0];
  const hello = useSyncExternalStore(noopSubscribe, greetingNow, () => 'Welcome back');

  return (
    <section aria-labelledby="home-hero-title" className="relative h-96 sm:h-92">
      <HeroBackdrop />
      <div className="px-gutter lg:px-gutter-lg absolute inset-x-0 bottom-6 flex max-w-2xl flex-col gap-1.5">
        <h1
          id="home-hero-title"
          className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
        >
          {firstName ? `${hello}, ${firstName}` : hello}
        </h1>
        <p className="text-muted-foreground">
          {resume ? 'Pick up where you left off.' : 'Fresh releases are waiting for you.'}
        </p>
        {picks.length > 0 ? (
          <ul
            aria-label={resume ? 'Recently played albums' : 'New releases'}
            className="mt-3 flex flex-wrap gap-2"
          >
            {picks.map((pick) => (
              <li key={pick.id}>
                <Link
                  href={`/albums/${pick.id}`}
                  className="bg-surface-2/85 border-border hover:bg-elevated flex max-w-60 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm font-medium backdrop-blur-sm"
                >
                  <CoverImage
                    image={pick.cover}
                    sizes="28px"
                    shape="round"
                    className="size-7 shrink-0"
                  />
                  <span className="truncate">{pick.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function HeroBackdrop() {
  const root = useRef<HTMLDivElement>(null);
  const pointer = usePointer(root);
  const reduceMotion = useReducedMotion() ?? false;
  const [visible, setVisible] = useState(true);
  const [design, setDesign] = useState<HeroDesign | null>(null);
  const { data } = useQuery(showcaseQuery());

  // An effect, not initial state: Next keeps Home mounted but hidden (<Activity>)
  // while the user is elsewhere and re-runs its effects when it shows again,
  // so this runs once per visit. It also keeps the server HTML free of the pick.
  // The pick waits a frame and the cleanup cancels it, so Strict Mode's double
  // run in development cannot skip a design.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setDesign(
        heroDesignForVisit(
          window.sessionStorage,
          new URLSearchParams(window.location.search).get('hero'),
        ),
      ),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry?.isIntersecting ?? true),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const Design = design ? DESIGNS[design] : null;
  return (
    <div
      ref={root}
      aria-hidden="true"
      data-hero={design ?? undefined}
      data-paused={visible ? undefined : ''}
      className="home-hero-backdrop absolute inset-0"
    >
      {Design ? (
        <Design covers={data?.covers ?? []} pointer={pointer} active={visible && !reduceMotion} />
      ) : null}
    </div>
  );
}
