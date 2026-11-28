'use client';

import { createContext, type ReactNode, type RefObject, useContext, useRef } from 'react';

const ScrollContainerContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

/**
 * The app's only scrolling element (ARCHITECTURE §7). It shares its ref so
 * scroll-linked effects (e.g. `useScroll({ container })`) measure this element,
 * not the window, which never scrolls.
 */
export function AppScrollArea({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <ScrollContainerContext value={ref}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </ScrollContainerContext>
  );
}

/** The ref of the app's scroll container; `null` outside the app shell. */
export function useAppScrollContainer(): RefObject<HTMLDivElement | null> | null {
  return useContext(ScrollContainerContext);
}
