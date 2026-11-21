import Link from 'next/link';
import { UserMenu } from '@/components/layout/user-menu';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-border flex h-14 items-center justify-between border-b px-4">
        <Link
          href="/"
          className="font-heading focus-visible:ring-ring rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-2"
        >
          Waven
        </Link>
        <UserMenu />
      </header>
      {children}
    </div>
  );
}
