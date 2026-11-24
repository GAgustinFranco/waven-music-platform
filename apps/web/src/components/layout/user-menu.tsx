'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gem, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { logout } from '@/lib/api/client';
import { initialsOf } from '@/lib/format';
import { meQuery } from '@/lib/api/queries';
import { useAuthStore } from '@/stores/auth.store';

export function UserMenu() {
  const status = useAuthStore((state) => state.status);
  const { data: me } = useQuery({ ...meQuery(), enabled: status === 'authenticated' });
  const queryClient = useQueryClient();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (status === 'unreachable') {
    // Nothing to load until the API is back (SessionGate shows the error).
    return null;
  }
  if (!me) {
    return <Skeleton className="size-8 rounded-full" aria-label="Loading your account" />;
  }

  async function signOut() {
    setSigningOut(true);
    await logout();
    queryClient.clear();
    router.replace('/login');
  }

  const premium = me.plan === 'premium';

  return (
    <div className="flex items-center gap-3">
      {premium ? <PremiumBadge /> : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hover:ring-brand/60 data-[state=open]:ring-brand rounded-full ring-2 ring-transparent hover:scale-105"
            aria-label="Account menu"
          >
            <Avatar>
              {me.avatarUrl ? (
                <AvatarImage src={me.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : null}
              <AvatarFallback>{initialsOf(me.displayName)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-foreground truncate font-medium">{me.displayName}</span>
            <span className="text-muted-foreground truncate text-xs font-normal">{me.email}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {premium ? 'Premium plan' : 'Free plan'}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserRound aria-hidden="true" />
              Profile and plan
            </Link>
          </DropdownMenuItem>
          {me.role === 'admin' ? (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck aria-hidden="true" />
                Admin panel
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Shown next to the account menu while the effective plan is Premium. */
function PremiumBadge() {
  return (
    <Link
      href="/profile"
      className="bg-brand/15 text-brand hover:bg-brand/25 hover:ring-brand/40 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-transparent hover:shadow-md hover:shadow-brand/20"
    >
      <Gem aria-hidden="true" className="size-3.5" />
      Premium
    </Link>
  );
}
