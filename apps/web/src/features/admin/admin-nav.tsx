'use client';

import {
  ChartColumn,
  CreditCard,
  Disc3,
  ListMusic,
  type LucideIcon,
  MicVocal,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from 'cn';

type AdminHref =
  | '/admin'
  | '/admin/users'
  | '/admin/subscriptions'
  | '/admin/artists'
  | '/admin/albums'
  | '/admin/tracks';

const ITEMS: readonly { href: AdminHref; label: string; icon: LucideIcon }[] = [
  { href: '/admin', label: 'Dashboard', icon: ChartColumn },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/artists', label: 'Artists', icon: MicVocal },
  { href: '/admin/albums', label: 'Albums', icon: Disc3 },
  { href: '/admin/tracks', label: 'Tracks', icon: ListMusic },
];

export const isAdminActive = (pathname: string, href: AdminHref) =>
  href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

/** Section navigation; the active item is marked once the path is known. */
export function AdminNav() {
  return (
    <Suspense fallback={<NavList pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavList pathname={usePathname()} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname !== null && isAdminActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'ease-standard flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-surface-2 text-foreground'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn('size-4 shrink-0', active && 'text-brand')}
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
