'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ListMusic, Pencil, Plus, SearchX, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { CoverImage } from '@/components/catalog/cover-image';
import { EmptyState, ErrorState, LoadingStatus } from '@/components/catalog/states';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminReady } from './admin-gate';
import {
  type AdminAlbum,
  adminAlbumQuery,
  type AdminTrack,
  adminTracksQuery,
} from '@/lib/api/admin';
import { isNotFound, isUuid } from '@/lib/api/catalog';
import { formatDuration } from '@/lib/format';
import { TITLE_MAX } from './albums-view';
import { ConfirmDialog, FormDialog, orNull, TextField } from './form';
import { errorMessage, useDeleteCatalogItem, useSaveAlbum, useSaveTrack } from './mutations';
import { type Column, DataTable, PRIMARY_BUTTON } from './table';
import { FileUpload, TrackStatusBadge } from './upload';

const LICENSE_MAX = 100;
/** One album never comes close to the API's page cap. */
const ALBUM_TRACKS_LIMIT = 50;

/** Album editor (US-17): details, cover and its tracks with audio uploads. */
export function AlbumEditor() {
  const { id } = useParams<{ id: string }>();
  const ready = useAdminReady();
  const validId = isUuid(id);
  const album = useQuery({ ...adminAlbumQuery(id), enabled: ready && validId });

  if (!validId || (album.isError && isNotFound(album.error))) {
    return (
      <EmptyState icon={SearchX} as="h1" title="We couldn't find that album">
        <Button asChild variant="secondary">
          <Link href="/admin/albums">Back to albums</Link>
        </Button>
      </EmptyState>
    );
  }
  if (album.isError) {
    return (
      <ErrorState
        as="h1"
        title="We couldn't load this album"
        onRetry={() => void album.refetch()}
        retrying={album.isFetching}
      />
    );
  }
  if (!album.data) {
    return <AlbumEditorSkeleton />;
  }
  return <AlbumEditorContent album={album.data} />;
}

function AlbumEditorContent({ album }: { album: AdminAlbum }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const remove = useDeleteCatalogItem();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/albums"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start rounded-md text-sm font-medium"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All albums
      </Link>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <CoverImage image={album.cover} sizes="160px" className="size-40 shrink-0" priority />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-muted-foreground text-sm font-medium">Album · {album.artist.name}</p>
          <h1 className="truncate text-3xl font-bold tracking-tight">{album.title}</h1>
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <FileUpload
              target={{ kind: 'album-cover', id: album.id }}
              label={album.cover ? 'Replace cover' : 'Upload cover'}
              accessibleName={`Cover of ${album.title}`}
            />
            <Button variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden="true" />
              Delete album
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Remounted after a save, so the fields restart from the saved values. */}
        <AlbumDetailsForm key={`${album.title}|${album.releaseDate}`} album={album} />
        <AlbumTracks album={album} />
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${album.title}?`}
        description="Only albums without tracks can be deleted. This cannot be undone."
        confirmLabel="Delete album"
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(
            { kind: 'album', id: album.id },
            {
              onSuccess: () => router.push('/admin/albums'),
              onSettled: () => setDeleting(false),
            },
          )
        }
      />
    </div>
  );
}

function AlbumDetailsForm({ album }: { album: AdminAlbum }) {
  const [title, setTitle] = useState(album.title);
  const [releaseDate, setReleaseDate] = useState(album.releaseDate ?? '');
  const save = useSaveAlbum();
  const titleError = title.trim() ? null : 'Enter a title.';
  const unchanged =
    title.trim() === album.title && (orNull(releaseDate) ?? null) === album.releaseDate;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (titleError || unchanged) {
      return;
    }
    save.mutate(
      { id: album.id, body: { title: title.trim(), releaseDate: orNull(releaseDate) } },
      {
        onSuccess: () => toast.success('Album saved'),
        onError: (error) => toast.error(errorMessage(error, "Couldn't save the album.")),
      },
    );
  };

  return (
    <section
      aria-labelledby="album-details"
      className="bg-surface flex flex-col gap-4 rounded-lg p-5"
    >
      <h2 id="album-details" className="text-lg font-semibold">
        Details
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
        <TextField
          label="Title"
          value={title}
          onChange={setTitle}
          maxLength={TITLE_MAX}
          required
          error={titleError}
        />
        <TextField label="Release date" type="date" value={releaseDate} onChange={setReleaseDate} />
        <Button
          type="submit"
          disabled={unchanged || save.isPending || titleError !== null}
          className={`${PRIMARY_BUTTON} self-start`}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </section>
  );
}

function AlbumTracks({ album }: { album: AdminAlbum }) {
  const ready = useAdminReady();
  const tracks = useQuery({
    ...adminTracksQuery({ albumId: album.id, limit: ALBUM_TRACKS_LIMIT, offset: 0 }),
    enabled: ready,
  });
  const [editing, setEditing] = useState<AdminTrack | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminTrack | null>(null);
  const remove = useDeleteCatalogItem();
  const items = tracks.data?.items;
  const nextNumber = Math.max(0, ...(items ?? []).map((track) => track.trackNumber)) + 1;

  const columns: Column<AdminTrack>[] = [
    {
      header: '#',
      className: 'w-10 tabular-nums text-muted-foreground',
      cell: (track) => track.trackNumber,
    },
    { header: 'Title', cell: (track) => <span className="font-medium">{track.title}</span> },
    {
      header: 'Length',
      optional: true,
      className: 'tabular-nums text-muted-foreground',
      cell: (track) => (track.durationMs === null ? '—' : formatDuration(track.durationMs)),
    },
    { header: 'Status', cell: (track) => <TrackStatusBadge track={track} /> },
    {
      header: 'Audio',
      cell: (track) => (
        <FileUpload
          compact
          target={{ kind: 'track-audio', id: track.id }}
          label={track.status === 'pending' ? 'Upload' : 'Replace'}
          accessibleName={`Audio for ${track.title}`}
        />
      ),
    },
    {
      header: 'Actions',
      className: 'w-24 text-right',
      cell: (track) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${track.title}`}
            onClick={() => setEditing(track)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${track.title}`}
            onClick={() => setDeleting(track)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section aria-labelledby="album-tracks" className="flex flex-col gap-4 xl:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="album-tracks" className="text-lg font-semibold">
          Tracks
        </h2>
        <Button className={PRIMARY_BUTTON} onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          Add track
        </Button>
      </div>
      <DataTable
        caption={`Tracks of ${album.title}`}
        columns={columns}
        rows={items}
        rowKey={(track) => track.id}
        loading={tracks.isFetching}
        error={tracks.isError}
        onRetry={() => void tracks.refetch()}
        empty={{
          icon: ListMusic,
          title: 'No tracks yet',
          description: 'Add a track, then upload its audio. It becomes playable once it is ready.',
        }}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
        title={editing === 'new' ? 'Add track' : 'Edit track'}
        description={editing === 'new' ? 'Upload its audio from the track list next.' : undefined}
      >
        {editing ? (
          <TrackForm
            albumId={album.id}
            track={editing === 'new' ? null : editing}
            defaultNumber={nextNumber}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.title ?? 'track'}?`}
        description="The track disappears from the catalog; playlists show it as unavailable."
        confirmLabel="Delete track"
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate({ kind: 'track', id: deleting.id }, { onSettled: () => setDeleting(null) })
        }
      />
    </section>
  );
}

function TrackForm({
  albumId,
  track,
  defaultNumber,
  onDone,
}: {
  albumId: string;
  track: AdminTrack | null;
  defaultNumber: number;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(track?.title ?? '');
  const [trackNumber, setTrackNumber] = useState(String(track?.trackNumber ?? defaultNumber));
  const [license, setLicense] = useState(track?.license ?? '');
  const [attributionUrl, setAttributionUrl] = useState(track?.attributionUrl ?? '');
  const [submitted, setSubmitted] = useState(false);
  const save = useSaveTrack();

  const number = Number(trackNumber);
  const errors = {
    title: title.trim() ? null : 'Enter a title.',
    trackNumber:
      Number.isInteger(number) && number >= 1 && number <= 999
        ? null
        : 'Use a number from 1 to 999.',
    attributionUrl:
      !attributionUrl.trim() || /^https?:\/\/\S+$/i.test(attributionUrl.trim())
        ? null
        : 'Use a full http(s) URL.',
  };
  const invalid = Object.values(errors).some(Boolean);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (invalid) {
      return;
    }
    const body = {
      title: title.trim(),
      trackNumber: number,
      license: orNull(license),
      attributionUrl: orNull(attributionUrl),
    };
    save.mutate(track ? { id: track.id, body } : { body: { ...body, albumId } }, {
      onSuccess: () => {
        toast.success(track ? 'Track saved' : 'Track added');
        onDone();
      },
      onError: (error) => toast.error(errorMessage(error, "Couldn't save the track.")),
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <TextField
        label="Title"
        value={title}
        onChange={setTitle}
        maxLength={TITLE_MAX}
        required
        error={submitted ? errors.title : null}
      />
      <TextField
        label="Track number"
        type="number"
        min={1}
        max={999}
        value={trackNumber}
        onChange={setTrackNumber}
        required
        error={submitted ? errors.trackNumber : null}
      />
      <TextField
        label="License"
        value={license}
        onChange={setLicense}
        maxLength={LICENSE_MAX}
        hint="For example, CC BY-NC-SA 3.0."
      />
      <TextField
        label="Attribution URL"
        type="url"
        value={attributionUrl}
        onChange={setAttributionUrl}
        hint="Where the work is credited."
        error={submitted ? errors.attributionUrl : null}
      />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending} className={PRIMARY_BUTTON}>
          {save.isPending ? 'Saving…' : track ? 'Save' : 'Add track'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AlbumEditorSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <LoadingStatus label="Loading album" />
      <Skeleton className="h-5 w-24" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Skeleton className="size-40 rounded-md" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-3 h-9 w-40" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg xl:col-span-2" />
      </div>
    </div>
  );
}
