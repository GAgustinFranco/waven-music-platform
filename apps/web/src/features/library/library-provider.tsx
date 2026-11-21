'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Gem } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/queries';
import { listenToLibraryChanges } from './library-sync';
import { useCreatePlaylist } from './mutations';

interface CreateOptions {
  /** Tracks for the new playlist ("Add to playlist → New playlist"). */
  trackIds?: string[];
  /** Opens the new playlist; otherwise only announces it. */
  navigate?: boolean;
}

interface LibraryContextValue {
  createPlaylist: (options?: CreateOptions) => void;
  creating: boolean;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) {
    throw new Error('useLibrary must be used inside <LibraryProvider>');
  }
  return value;
}

/**
 * Library actions shared by the sidebar, the library page and the track menus:
 * creating a playlist (with the upgrade prompt when the plan's limit is hit,
 * US-16) and refetching what other tabs changed. Confirmations are toasts.
 */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const create = useCreatePlaylist();
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => listenToLibraryChanges(queryClient), [queryClient]);

  const { mutate, isPending } = create;
  const createPlaylist = useCallback(
    ({ trackIds, navigate = true }: CreateOptions = {}) => {
      mutate(
        { trackIds },
        {
          onSuccess: (playlist) => {
            toast.success(`Created ${playlist.name}`);
            if (navigate) {
              router.push(`/playlists/${playlist.id}`);
            }
          },
          onError: (error) => {
            if (error instanceof ApiError && error.code === 'PLAN_LIMIT_REACHED') {
              setLimitReached(true);
            } else {
              toast.error("Couldn't create the playlist. Try again.");
            }
          },
        },
      );
    },
    [mutate, router],
  );

  const value = useMemo(
    () => ({ createPlaylist, creating: isPending }),
    [createPlaylist, isPending],
  );

  return (
    <LibraryContext value={value}>
      {children}
      <UpgradeDialog open={limitReached} onOpenChange={setLimitReached} />
    </LibraryContext>
  );
}

function UpgradeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <Gem aria-hidden="true" className="text-brand size-8" />
        <DialogTitle>You&apos;ve reached 5 playlists</DialogTitle>
        <DialogDescription>
          The Free plan includes up to 5 playlists. Upgrade to Premium for unlimited playlists and
          high-quality streaming, or delete a playlist to make room.
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Not now</Button>
          </DialogClose>
          <Button asChild className="bg-brand text-primary-foreground hover:bg-brand-hover">
            <Link href="/premium" onClick={() => onOpenChange(false)}>
              See Premium
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
