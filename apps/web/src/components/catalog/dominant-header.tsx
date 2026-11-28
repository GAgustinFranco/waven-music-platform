'use client';

import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useAppScrollContainer } from '@/components/layout/app-scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { ImageSet } from '@/lib/api/catalog';
import { dominantColorStyle } from '@/lib/dominant-color';
import { CoverImage } from './cover-image';
import { glarePosition, HEADER_MOTION, isBarShown } from './header-motion';

interface DominantHeaderProps {
  /** "Album", "Artist"… shown above the title. */
  kind: string;
  title: string;
  image: ImageSet | null;
  imageShape?: 'square' | 'round';
  dominantColor: string | null;
  /** Replaces the image, e.g. a playlist mosaic; gets the cover size through `COVER_CLASS`. */
  cover?: ReactNode;
  /** Play button of the compact bar shown once the header scrolls away. */
  play?: ReactNode;
  /** Meta line under the title (artist link, year, track count…). */
  children?: ReactNode;
}

const HEADER =
  'dominant-header px-gutter lg:px-gutter-lg flex flex-col gap-4 pt-20 pb-6 sm:flex-row sm:items-end sm:gap-6 lg:pt-28';
const COVER = 'aspect-square w-40 shrink-0 self-center sm:w-48 sm:self-auto lg:w-58';
export const COVER_CLASS = `${COVER} shadow-xl`;
export const COVER_SIZES = '(min-width: 1024px) 232px, (min-width: 640px) 192px, 160px';

const SPRING = { stiffness: 320, damping: 40, mass: 0.6 };

/**
 * Page header with the dominant-color gradient (color → --bg). While the app's
 * content scrolls, the cover shrinks, the text fades and a compact bar with the
 * title and `play` takes its place under the app header. Transforms and opacity
 * only, so nothing reflows; under reduced motion the bar simply appears.
 */
export function DominantHeader({
  kind,
  title,
  image,
  imageShape = 'square',
  dominantColor,
  cover,
  play,
  children,
}: DominantHeaderProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const headerRef = useRef<HTMLElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const container = useAppScrollContainer();
  const { scrollYProgress } = useScroll({
    container: container ?? undefined,
    target: headerRef,
    offset: ['start start', 'end start'],
  });

  const coverScale = useSpring(
    useTransform(scrollYProgress, HEADER_MOTION.coverScale.range, HEADER_MOTION.coverScale.output),
    SPRING,
  );
  const textOpacity = useTransform(
    scrollYProgress,
    HEADER_MOTION.textOpacity.range,
    HEADER_MOTION.textOpacity.output,
  );
  const barOpacity = useTransform(
    scrollYProgress,
    HEADER_MOTION.barOpacity.range,
    HEADER_MOTION.barOpacity.output,
  );
  const glareOpacity = useSpring(0, SPRING);

  const [barShown, setBarShown] = useState(false);
  useMotionValueEvent(scrollYProgress, 'change', (progress) => setBarShown(isBarShown(progress)));

  // Tells the app header the bar is up (the mobile logo steps aside). An effect, so a page
  // that Next keeps hidden after navigating clears the flag through its cleanup.
  useEffect(() => {
    const element = container?.current;
    if (!barShown || !element) {
      return;
    }
    element.setAttribute('data-compact-bar', '');
    return () => element.removeAttribute('data-compact-bar');
  }, [barShown, container]);

  const moveGlare = (event: PointerEvent<HTMLElement>) => {
    const glare = glareRef.current;
    if (event.pointerType !== 'mouse' || !glare || !headerRef.current) {
      return;
    }
    const { x, y } = glarePosition(
      event.clientX,
      event.clientY,
      headerRef.current.getBoundingClientRect(),
    );
    glare.style.setProperty('--glare-x', x);
    glare.style.setProperty('--glare-y', y);
    glareOpacity.set(1);
  };

  const colorStyle = dominantColorStyle(dominantColor);
  const shownOpacity = barShown ? 1 : 0;

  return (
    <>
      {/* Zero-height sticky layers: the tint sits under the app header's scrim, the bar above it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none sticky top-0 z-30 h-0"
        style={colorStyle}
      >
        <motion.div
          className="dominant-bar absolute inset-x-0 top-0 h-16"
          style={{ opacity: reduceMotion ? shownOpacity : barOpacity }}
        />
      </div>
      <div className="sticky top-0 z-50 h-0">
        <motion.div
          inert={!barShown}
          className="px-gutter lg:px-gutter-lg absolute top-0 right-[calc(var(--spacing-gutter)+var(--spacing-header-actions))] left-0 flex h-16 items-center gap-3"
          style={{ opacity: reduceMotion ? shownOpacity : barOpacity }}
        >
          {play}
          {/* The page's h1 already names it; this is a visual repeat. */}
          <p aria-hidden="true" className="truncate text-lg font-semibold tracking-tight">
            {title}
          </p>
        </motion.div>
      </div>

      <header
        ref={headerRef}
        className={`${HEADER} relative isolate overflow-hidden`}
        style={colorStyle}
        onPointerMove={reduceMotion ? undefined : moveGlare}
        onPointerLeave={() => glareOpacity.set(0)}
      >
        <motion.div
          className="shrink-0 origin-bottom self-center sm:origin-bottom-left sm:self-auto"
          style={{ scale: reduceMotion ? 1 : coverScale }}
        >
          {cover ?? (
            <CoverImage
              image={image}
              shape={imageShape}
              sizes={COVER_SIZES}
              priority
              className={COVER_CLASS}
            />
          )}
        </motion.div>
        <motion.div
          className="flex min-w-0 flex-col gap-2"
          style={{ opacity: reduceMotion ? 1 : textOpacity }}
        >
          <p className="text-sm font-medium">{kind}</p>
          <h1 className="text-3xl font-bold tracking-tight break-words lg:text-5xl">{title}</h1>
          {children ? <div className="text-sm">{children}</div> : null}
        </motion.div>
        <motion.div
          ref={glareRef}
          aria-hidden="true"
          className="dominant-glare pointer-events-none absolute inset-0 -z-10"
          style={{ opacity: glareOpacity }}
        />
      </header>
    </>
  );
}

export function DominantHeaderSkeleton({ shape = 'square' }: { shape?: 'square' | 'round' }) {
  return (
    <div aria-hidden="true" className={HEADER}>
      <Skeleton className={`${COVER} ${shape === 'round' ? 'rounded-full' : ''}`} />
      <div className="flex w-full flex-col gap-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
