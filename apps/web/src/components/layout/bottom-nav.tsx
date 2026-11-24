'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from 'cn';
import { isActive, NAV_ITEMS } from './nav-items';

/** Mobile (< 768 px) 4-item navigation. The mini player sits above it. */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavLinks pathname={null} />}>
      <ActiveBottomNav />
    </Suspense>
  );
}

function ActiveBottomNav() {
  return <BottomNavLinks pathname={usePathname()} />;
}

function BottomNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="bg-surface border-border border-t md:hidden">
      <ul className="h-bottom-nav grid grid-cols-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group ease-standard m-1 flex flex-1 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium -outline-offset-2 transition-colors duration-150',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/8 hover:text-foreground',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'ease-standard size-6 transition-[color,scale] duration-150 group-hover:scale-110',
                    active ? 'text-brand' : 'group-hover:text-brand',
                  )}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
