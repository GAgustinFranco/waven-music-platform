'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MicVocal, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { CoverImage } from '@/components/catalog/cover-image';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useAdminReady } from './admin-gate';
import { type AdminArtist, adminArtistsQuery } from '@/lib/api/admin';
import { ConfirmDialog, FormDialog, orNull, TextField } from './form';
import { errorMessage, useDeleteCatalogItem, useSaveArtist } from './mutations';
import {
  type Column,
  DataTable,
  formatDate,
  PageHeader,
  Pagination,
  PRIMARY_BUTTON,
  SearchField,
  useTableState,
} from './table';
import { FileUpload } from './upload';

const NAME_MAX = 200;
const BIO_MAX = 5000;

/** Artists (US-17): create, edit (with an image) and delete. */
export function ArtistsView() {
  const ready = useAdminReady();
  const table = useTableState();
  const artists = useQuery({
    ...adminArtistsQuery({ q: table.q, limit: table.limit, offset: table.offset }),
    enabled: ready,
    placeholderData: keepPreviousData,
  });
  /** `null`: closed; `'new'`: creating; an artist: editing it. */
  const [editing, setEditing] = useState<AdminArtist | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminArtist | null>(null);
  const remove = useDeleteCatalogItem();
  // Read the edited artist from the list, so an uploaded image shows up in the dialog.
  const current =
    editing && editing !== 'new'
      ? (artists.data?.items.find((artist) => artist.id === editing.id) ?? editing)
      : editing;

  const columns: Column<AdminArtist>[] = [
    {
      header: 'Artist',
      cell: (artist) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverImage
            image={artist.image}
            sizes="40px"
            shape="round"
            className="size-10 shrink-0"
          />
          <span className="truncate font-medium">{artist.name}</span>
        </div>
      ),
    },
    {
      header: 'Source',
      cell: (artist) => <span className="capitalize">{artist.source}</span>,
      optional: true,
    },
    { header: 'Created', cell: (artist) => formatDate(artist.createdAt), optional: true },
    {
      header: 'Actions',
      className: 'w-24 text-right',
      cell: (artist) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${artist.name}`}
            onClick={() => setEditing(artist)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${artist.name}`}
            onClick={() => setDeleting(artist)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Artists"
        description="Artists are listed publicly once they have a ready track."
        actions={
          <Button className={PRIMARY_BUTTON} onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            New artist
          </Button>
        }
      />
      <SearchField value={table.search} onChange={table.setSearch} label="Search artists" />
      <DataTable
        caption="Artists"
        columns={columns}
        rows={artists.data?.items}
        rowKey={(artist) => artist.id}
        loading={artists.isFetching}
        stale={artists.isPlaceholderData}
        error={artists.isError}
        onRetry={() => void artists.refetch()}
        empty={{ icon: MicVocal, title: 'No artists found', description: 'Create one to start.' }}
      />
      <Pagination
        label="Artists"
        total={artists.data?.total}
        offset={table.offset}
        limit={table.limit}
        onChange={table.setOffset}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
        title={editing === 'new' ? 'New artist' : 'Edit artist'}
        description={editing === 'new' ? 'You can add an image after creating it.' : undefined}
      >
        {current ? (
          <ArtistForm
            key={current === 'new' ? 'new' : current.id}
            artist={current === 'new' ? null : current}
            onSaved={setEditing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.name ?? 'artist'}?`}
        description="Artists with albums cannot be deleted. This cannot be undone."
        confirmLabel="Delete artist"
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate({ kind: 'artist', id: deleting.id }, { onSettled: () => setDeleting(null) })
        }
      />
    </div>
  );
}

function ArtistForm({
  artist,
  onSaved,
  onDone,
}: {
  artist: AdminArtist | null;
  /** After creating, the dialog switches to editing so the image can be uploaded. */
  onSaved: (artist: AdminArtist) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(artist?.name ?? '');
  const [bio, setBio] = useState(artist?.bio ?? '');
  const [submitted, setSubmitted] = useState(false);
  const save = useSaveArtist();
  const nameError = name.trim() ? null : 'Enter a name.';

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (nameError) {
      return;
    }
    save.mutate(
      { id: artist?.id, body: { name: name.trim(), bio: orNull(bio) } },
      {
        onSuccess: (saved) => {
          toast.success(artist ? 'Artist saved' : 'Artist created');
          if (artist) {
            onDone();
          } else {
            onSaved(saved);
          }
        },
        onError: (error) => toast.error(errorMessage(error, "Couldn't save the artist.")),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {artist ? (
        <div className="flex items-center gap-4">
          <CoverImage
            image={artist.image}
            sizes="80px"
            shape="round"
            className="size-20 shrink-0"
          />
          <FileUpload
            target={{ kind: 'artist-image', id: artist.id }}
            label="Upload image"
            accessibleName={`Image of ${artist.name}`}
          />
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
        <TextField
          label="Name"
          value={name}
          onChange={setName}
          maxLength={NAME_MAX}
          required
          error={submitted ? nameError : null}
        />
        <TextField label="Bio" value={bio} onChange={setBio} maxLength={BIO_MAX} multiline />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone}>
            {artist ? 'Close' : 'Cancel'}
          </Button>
          <Button type="submit" disabled={save.isPending} className={PRIMARY_BUTTON}>
            {save.isPending ? 'Saving…' : artist ? 'Save' : 'Create artist'}
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}
