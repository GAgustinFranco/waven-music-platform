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
  useRef,
  useState,
} from 'react';
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
  /** A short confirmation, shown briefly and read by screen readers. */
  announce: (message: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) {
    throw new Error('useLibrary must be used inside <LibraryProvider>');
  }
  return value;
}

const MESSAGE_MS = 3_000;

/**
 * Library actions shared by the sidebar, the library page and the track menus:
 * creating a playlist (with the upgrade prompt when the plan's limit is hit,
 * US-16), confirmations, and refetching what other tabs changed.
 */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const create = useCreatePlaylist();
  const [limitReached, setLimitReached] = useState(false);
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => listenToLibraryChanges(queryClient), [queryClient]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const announce = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(''), MESSAGE_MS);
  }, []);

  const { mutate, isPending } = create;
  const createPlaylist = useCallback(
    ({ trackIds, navigate = true }: CreateOptions = {}) => {
      mutate(
        { trackIds },
        {
          onSuccess: (playlist) => {
            announce(`Created ${playlist.name}`);
            if (navigate) {
              router.push(`/playlists/${playlist.id}`);
            }
          },
          onError: (error) => {
            if (error instanceof ApiError && error.code === 'PLAN_LIMIT_REACHED') {
              setLimitReached(true);
            } else {
              announce("Couldn't create the playlist. Try again.");
            }
          },
        },
      );
    },
    [announce, mutate, router],
  );

  const value = useMemo(
    () => ({ createPlaylist, creating: isPending, announce }),
    [announce, createPlaylist, isPending],
  );

  return (
    <LibraryContext value={value}>
      {children}
      <UpgradeDialog open={limitReached} onOpenChange={setLimitReached} />
      <p
        role="status"
        aria-live="polite"
        className={
          message
            ? 'bg-elevated text-foreground fixed bottom-40 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm font-medium shadow-lg md:bottom-28'
            : 'sr-only'
        }
      >
        {message}
      </p>
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
