'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ListMusic } from 'lucide-react';
import Link from 'next/link';
import { useAdminReady } from './admin-gate';
import { type AdminTrack, adminTracksQuery } from '@/lib/api/admin';
import {
  type Column,
  DataTable,
  PageHeader,
  Pagination,
  SearchField,
  useTableState,
} from './table';
import { TrackStatusBadge } from './upload';

/** Every track that is not deleted, in any status; edits happen in the album editor. */
export function TracksView() {
  const ready = useAdminReady();
  const table = useTableState();
  const tracks = useQuery({
    ...adminTracksQuery({ q: table.q, limit: table.limit, offset: table.offset }),
    enabled: ready,
    placeholderData: keepPreviousData,
  });

  const columns: Column<AdminTrack>[] = [
    { header: 'Title', cell: (track) => <span className="font-medium">{track.title}</span> },
    {
      header: 'Album',
      cell: (track) => (
        <Link href={`/admin/albums/${track.album.id}`} className="rounded-md hover:underline">
          {track.album.title}
        </Link>
      ),
    },
    { header: 'Artist', cell: (track) => track.artist.name, optional: true },
    { header: 'Status', cell: (track) => <TrackStatusBadge track={track} /> },
    {
      header: 'Plays',
      className: 'text-right tabular-nums',
      cell: (track) => track.playCount.toLocaleString('en'),
      optional: true,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tracks"
        description="To add or edit tracks and upload audio, open their album."
      />
      <SearchField value={table.search} onChange={table.setSearch} label="Search tracks" />
      <DataTable
        caption="Tracks"
        columns={columns}
        rows={tracks.data?.items}
        rowKey={(track) => track.id}
        loading={tracks.isFetching}
        stale={tracks.isPlaceholderData}
        error={tracks.isError}
        onRetry={() => void tracks.refetch()}
        empty={{ icon: ListMusic, title: 'No tracks found', description: 'Try another search.' }}
      />
      <Pagination
        label="Tracks"
        total={tracks.data?.total}
        offset={table.offset}
        limit={table.limit}
        onChange={table.setOffset}
      />
    </div>
  );
}
