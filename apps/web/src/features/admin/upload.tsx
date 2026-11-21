'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Clock, LoaderCircle, Upload } from 'lucide-react';
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  adminKeys,
  type AdminTrack,
  adminTrackQuery,
  isTranscoding,
  type TrackStatus,
  type UploadKind,
  uploadHint,
  UPLOAD_RULES,
  validateUpload,
} from '@/lib/api/admin';
import { catalogKeys } from '@/lib/api/catalog';
import { type UploadTarget, useUpload } from './mutations';
import { Badge } from './table';

const KIND_OF_TARGET: Record<UploadTarget['kind'], UploadKind> = {
  'artist-image': 'image',
  'album-cover': 'image',
  'track-audio': 'audio',
};

interface FileUploadProps {
  target: UploadTarget;
  /** Visible label of the button, for example "Upload cover". */
  label: string;
  /** Names what the file is for, for assistive tech ("Audio for Track 1"). */
  accessibleName?: string;
  onUploaded?: () => void;
  compact?: boolean;
}

/** File picker that validates locally, uploads with a progress bar and can be cancelled. */
export function FileUpload({
  target,
  label,
  accessibleName,
  onUploaded,
  compact,
}: FileUploadProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUpload();
  const kind = KIND_OF_TARGET[target.kind];

  useEffect(() => () => abort.current?.abort(), []);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const invalid = validateUpload(file, kind);
    setError(invalid);
    if (invalid) {
      return;
    }
    abort.current = new AbortController();
    setProgress(0);
    upload.mutate(
      { target, file, options: { onProgress: setProgress, signal: abort.current.signal } },
      {
        onSuccess: () => {
          toast.success(kind === 'audio' ? 'Upload complete. Transcoding…' : 'Image uploaded');
          onUploaded?.();
        },
        onSettled: () => {
          setProgress(null);
          abort.current = null;
        },
      },
    );
  };

  const uploading = progress !== null;
  const percent = Math.round((progress ?? 0) * 100);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <input
        ref={input}
        id={id}
        type="file"
        accept={UPLOAD_RULES[kind].accept}
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      {uploading ? (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={`Uploading ${accessibleName ?? label.toLowerCase()}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="bg-surface-2 h-2 min-w-24 flex-1 overflow-hidden rounded-full"
          >
            <div
              className="bg-brand ease-standard h-full rounded-full transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
            {percent}%
          </span>
          <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size={compact ? 'sm' : 'default'}
          variant="secondary"
          onClick={() => input.current?.click()}
          aria-label={accessibleName ? `${label}: ${accessibleName}` : undefined}
          className="self-start"
        >
          <Upload aria-hidden="true" />
          {label}
        </Button>
      )}
      {compact ? null : (
        <p
          className={
            error ? 'text-danger min-h-5 text-xs' : 'text-muted-foreground min-h-5 text-xs'
          }
          role={error ? 'alert' : undefined}
        >
          {error ?? uploadHint(kind)}
        </p>
      )}
      {compact && error ? (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const STATUS = {
  pending: { tone: 'warning', icon: Clock, label: 'No audio' },
  processing: { tone: 'brand', icon: LoaderCircle, label: 'Transcoding' },
  ready: { tone: 'success', icon: CircleCheck, label: 'Ready' },
  failed: { tone: 'danger', icon: CircleAlert, label: 'Failed' },
} as const satisfies Record<TrackStatus, { tone: string; icon: unknown; label: string }>;

const POLL_MS = 1500;

/**
 * Transcoding status. While a track is `processing` it polls the track, and when
 * it settles it refreshes the lists and the public catalog, so a ready track is
 * playable at once.
 */
export function TrackStatusBadge({ track }: { track: AdminTrack }) {
  const queryClient = useQueryClient();
  const live = useQuery({
    ...adminTrackQuery(track.id),
    initialData: track,
    refetchInterval: (query) =>
      query.state.data && isTranscoding(query.state.data.status) ? POLL_MS : false,
  });
  const status = live.data.status;
  const previous = useRef(status);

  useEffect(() => {
    if (previous.current === 'processing' && status !== 'processing') {
      void queryClient.invalidateQueries({ queryKey: adminKeys.tracks() });
      void queryClient.invalidateQueries({ queryKey: adminKeys.allStats() });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
      if (status === 'ready') {
        toast.success(`“${live.data.title}” is ready to play`);
      } else if (status === 'failed') {
        toast.error(`Transcoding “${live.data.title}” failed. Upload the file again.`);
      }
    }
    previous.current = status;
  }, [status, live.data.title, queryClient]);

  const { tone, icon: Icon, label } = STATUS[status];
  return (
    <span aria-live="polite">
      <Badge tone={tone}>
        <Icon
          aria-hidden="true"
          className={status === 'processing' ? 'size-3.5 motion-safe:animate-spin' : 'size-3.5'}
        />
        {label}
      </Badge>
    </span>
  );
}
