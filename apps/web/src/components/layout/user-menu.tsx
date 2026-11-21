'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, ShieldCheck, UserRound } from 'lucide-react';
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
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
          <span className="text-muted-foreground text-xs font-normal capitalize">
            {me.plan} plan
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
  );
}
