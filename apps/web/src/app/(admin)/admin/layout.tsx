import { ArrowLeft, AudioLines } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { UserMenu } from '@/components/layout/user-menu';
import { AdminGate } from '@/features/admin/admin-gate';
import { AdminNav } from '@/features/admin/admin-nav';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · Waven' } };

/** Admin shell: no player, a section nav and the content. Access is checked by `AdminGate`. */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-brand text-primary-foreground sr-only z-50 rounded-md px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="bg-scrim border-border px-gutter lg:px-gutter-lg sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-4 border-b backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-md text-lg font-semibold tracking-tight"
          >
            <AudioLines aria-hidden="true" className="text-brand size-6" />
            Waven <span className="text-muted-foreground font-normal">Admin</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to app
          </Link>
          <UserMenu />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="px-gutter lg:px-gutter-lg flex-1 py-6 outline-none">
        {/* Nothing admin-only renders until the role is confirmed. */}
        <AdminGate>
          <div className="flex flex-col gap-6 md:flex-row">
            <aside aria-label="Admin sections" className="md:w-52 md:shrink-0">
              <AdminNav />
            </aside>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </AdminGate>
      </main>
    </div>
  );
}
