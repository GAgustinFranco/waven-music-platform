'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
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
import type { PlaylistDetail } from '@/lib/api/library';
import { useDeletePlaylist, useUpdatePlaylist } from './mutations';

const NAME_MAX = 100;
const DESCRIPTION_MAX = 300;
const FIELD =
  'bg-surface-2 border-input text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm';

interface DialogProps {
  playlist: PlaylistDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Rename and describe (US-11). Mounted only while open, so it starts from the saved values. */
export function EditPlaylistDialog({ playlist, open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <EditPlaylistForm playlist={playlist} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditPlaylistForm({ playlist, onDone }: { playlist: PlaylistDetail; onDone: () => void }) {
  const id = useId();
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? '');
  const update = useUpdatePlaylist(playlist.id);
  const trimmed = name.trim();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) {
      return;
    }
    update.mutate(
      { name: trimmed, description: description.trim() || null },
      {
        onSuccess: () => {
          toast.success('Playlist saved');
          onDone();
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <DialogTitle>Edit details</DialogTitle>
      <DialogDescription>Playlists are private: only you can see them.</DialogDescription>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">
          Name
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={NAME_MAX}
          required
          aria-invalid={trimmed ? undefined : true}
          aria-describedby={trimmed ? undefined : `${id}-name-error`}
          className={FIELD}
        />
        {trimmed ? null : (
          <p id={`${id}-name-error`} className="text-danger text-sm">
            A playlist needs a name.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-description`} className="text-sm font-medium">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          id={`${id}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          className={`${FIELD} resize-none`}
        />
      </div>
      {update.isError ? (
        <p role="alert" className="text-danger text-sm">
          Couldn&apos;t save the changes. Try again.
        </p>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={!trimmed || update.isPending}
          className="bg-brand text-primary-foreground hover:bg-brand-hover"
        >
          {update.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function DeletePlaylistDialog({ playlist, open, onOpenChange }: DialogProps) {
  const remove = useDeletePlaylist(playlist.id);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog">
        <DialogTitle>Delete {playlist.name}?</DialogTitle>
        <DialogDescription>
          This removes the playlist and its track list. The tracks stay in the catalog. This
          can&apos;t be undone.
        </DialogDescription>
        {remove.isError ? (
          <p role="alert" className="text-danger text-sm">
            Couldn&apos;t delete the playlist. Try again.
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`Deleted ${playlist.name}`);
                  router.push('/library');
                },
              })
            }
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
