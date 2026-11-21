'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Disc3, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { CoverImage } from '@/components/catalog/cover-image';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { useAdminReady } from './admin-gate';
import { type AdminAlbum, adminAlbumsQuery, adminArtistsQuery } from '@/lib/api/admin';
import { FormDialog, orNull, TextField } from './form';
import { errorMessage, useSaveAlbum } from './mutations';
import {
  type Column,
  DataTable,
  FIELD,
  formatDate,
  PageHeader,
  Pagination,
  PRIMARY_BUTTON,
  SearchField,
  useTableState,
} from './table';

export const TITLE_MAX = 200;

/** Albums (US-17): list and create; each album opens in its editor. */
export function AlbumsView() {
  const ready = useAdminReady();
  const table = useTableState();
  const albums = useQuery({
    ...adminAlbumsQuery({ q: table.q, limit: table.limit, offset: table.offset }),
    enabled: ready,
    placeholderData: keepPreviousData,
  });
  const [creating, setCreating] = useState(false);

  const columns: Column<AdminAlbum>[] = [
    {
      header: 'Album',
      cell: (album) => (
        <Link
          href={`/admin/albums/${album.id}`}
          className="flex min-w-0 items-center gap-3 rounded-md hover:underline"
        >
          <CoverImage image={album.cover} sizes="40px" className="size-10 shrink-0" />
          <span className="truncate font-medium">{album.title}</span>
        </Link>
      ),
    },
    { header: 'Artist', cell: (album) => album.artist.name },
    { header: 'Released', cell: (album) => formatDate(album.releaseDate), optional: true },
    {
      header: 'Source',
      cell: (album) => <span className="capitalize">{album.source}</span>,
      optional: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Albums"
        description="Open an album to edit it, upload its cover and add tracks."
        actions={
          <Button className={PRIMARY_BUTTON} onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New album
          </Button>
        }
      />
      <SearchField value={table.search} onChange={table.setSearch} label="Search albums" />
      <DataTable
        caption="Albums"
        columns={columns}
        rows={albums.data?.items}
        rowKey={(album) => album.id}
        loading={albums.isFetching}
        stale={albums.isPlaceholderData}
        error={albums.isError}
        onRetry={() => void albums.refetch()}
        empty={{ icon: Disc3, title: 'No albums found', description: 'Create one to start.' }}
      />
      <Pagination
        label="Albums"
        total={albums.data?.total}
        offset={table.offset}
        limit={table.limit}
        onChange={table.setOffset}
      />
      <FormDialog
        open={creating}
        onOpenChange={setCreating}
        title="New album"
        description="Next, you can upload the cover and add its tracks."
      >
        <CreateAlbumForm onCancel={() => setCreating(false)} />
      </FormDialog>
    </div>
  );
}

function CreateAlbumForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [artistSearch, setArtistSearch] = useState('');
  const [artistId, setArtistId] = useState('');
  const [title, setTitle] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const artists = useQuery({
    ...adminArtistsQuery({ q: artistSearch.trim(), limit: 50, offset: 0 }),
    placeholderData: keepPreviousData,
  });
  const save = useSaveAlbum();
  const artistError = artistId ? null : 'Choose an artist.';
  const titleError = title.trim() ? null : 'Enter a title.';

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (artistError || titleError) {
      return;
    }
    save.mutate(
      { body: { artistId, title: title.trim(), releaseDate: orNull(releaseDate) } },
      {
        onSuccess: (album) => {
          toast.success('Album created');
          router.push(`/admin/albums/${album.id}`);
        },
        onError: (error) => toast.error(errorMessage(error, "Couldn't create the album.")),
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Artist</legend>
        <SearchField value={artistSearch} onChange={setArtistSearch} label="Find an artist" />
        <label htmlFor="album-artist" className="sr-only">
          Artist
        </label>
        <select
          id="album-artist"
          value={artistId}
          onChange={(event) => setArtistId(event.target.value)}
          aria-invalid={submitted && artistError ? true : undefined}
          aria-describedby="album-artist-hint"
          className={FIELD}
        >
          <option value="">
            {artists.data && artists.data.items.length === 0
              ? 'No artists match'
              : 'Choose an artist'}
          </option>
          {artists.data?.items.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name}
            </option>
          ))}
        </select>
        <p
          id="album-artist-hint"
          className={
            submitted && artistError
              ? 'text-danger min-h-5 text-xs'
              : 'text-muted-foreground min-h-5 text-xs'
          }
        >
          {submitted && artistError ? artistError : 'Create the artist first if it is not listed.'}
        </p>
      </fieldset>
      <TextField
        label="Title"
        value={title}
        onChange={setTitle}
        maxLength={TITLE_MAX}
        required
        error={submitted ? titleError : null}
      />
      <TextField label="Release date" type="date" value={releaseDate} onChange={setReleaseDate} />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending} className={PRIMARY_BUTTON}>
          {save.isPending ? 'Creating…' : 'Create album'}
        </Button>
      </DialogFooter>
    </form>
  );
}
