import { AudioLines } from 'lucide-react';
import Link from 'next/link';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PlayerBarSlot } from '@/components/layout/player-bar-slot';
import { Sidebar } from '@/components/layout/sidebar';
import { UserMenu } from '@/components/layout/user-menu';

/**
 * App shell (ARCHITECTURE §7): sidebar + scrolling content + player bar on
 * tablet/desktop, content + bottom navigation on mobile. Only the content scrolls.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="md:grid-cols-[var(--spacing-sidebar-collapsed)_minmax(0,1fr)] lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)] flex h-dvh flex-col overflow-hidden md:grid md:grid-rows-[minmax(0,1fr)_auto]">
      <a
        href="#main"
        className="bg-brand text-primary-foreground sr-only z-50 rounded-md px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <Sidebar />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="bg-scrim px-gutter lg:px-gutter-lg sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between backdrop-blur-md md:justify-end">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight md:hidden"
          >
            <AudioLines aria-hidden="true" className="text-brand size-6" />
            Waven
          </Link>
          <UserMenu />
        </header>
        {/* Pages render their own header and sections; -mt-16 lets gradients reach the top. */}
        <main id="main" tabIndex={-1} className="-mt-16 flex flex-1 flex-col pb-8 outline-none">
          {children}
        </main>
      </div>

      <PlayerBarSlot />
      <BottomNav />
    </div>
  );
}
