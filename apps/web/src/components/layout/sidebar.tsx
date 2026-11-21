'use client';

import { AudioLines } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from 'cn';
import { isActive, NAV_ITEMS } from './nav-items';

/**
 * Desktop (≥ 1024 px): 280 px with labels. Tablet (768–1023 px): collapsed to
 * icons, with the label kept as the accessible name and a tooltip.
 */
export function Sidebar() {
  return (
    <aside className="bg-surface hidden flex-col gap-6 p-3 md:flex lg:p-4" aria-label="Sidebar">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-md px-2 py-1 text-xl font-semibold tracking-tight max-lg:justify-center"
      >
        <AudioLines aria-hidden="true" className="text-brand size-7 shrink-0" />
        <span className="max-lg:sr-only">Waven</span>
      </Link>

      {/* The path is request-time data: prerender the links, mark the active one after. */}
      <Suspense fallback={<SidebarNav pathname={null} />}>
        <ActiveSidebarNav />
      </Suspense>
    </aside>
  );
}

function ActiveSidebarNav() {
  return <SidebarNav pathname={usePathname()} />;
}

function SidebarNav({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                title={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'ease-standard flex items-center gap-4 rounded-md px-3 py-2.5 text-base font-medium transition-colors duration-150 max-lg:justify-center',
                  active
                    ? 'bg-surface-2 text-foreground'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn('size-6 shrink-0', active && 'text-brand')}
                />
                <span className="max-lg:sr-only">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
