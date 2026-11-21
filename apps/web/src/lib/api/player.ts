import { api } from './client';
import { toApiError } from './queries';
import type { components } from './schema';

export type StreamUrl = components['schemas']['StreamUrlDto'];
export type PlayContext = components['schemas']['PlayContext'];
export type RecordPlay = components['schemas']['RecordPlayDto'];

/*
 * The audio engine runs outside React and calls these directly instead of going
 * through TanStack Query: they are imperative playback commands (with the
 * engine's own token cache), not server state rendered by the UI.
 */

export async function fetchStreamUrl(trackId: string): Promise<StreamUrl> {
  const { data, error, response } = await api.POST('/tracks/{id}/stream', {
    params: { path: { id: trackId } },
  });
  if (!data) {
    throw toApiError(error, response);
  }
  return data;
}

export async function reportPlay(body: RecordPlay): Promise<void> {
  const { error, response } = await api.POST('/me/history', { body });
  if (!response.ok) {
    throw toApiError(error, response);
  }
}

/** Mirrors the API rule (SPEC §6.4): 30 s, or the whole track (minus 1 s) if it is shorter. */
export const MIN_PLAY_MS = 30_000;
export const FULL_PLAY_TOLERANCE_MS = 1_000;

export function requiredPlayMs(durationMs: number | null | undefined): number {
  if (!durationMs || durationMs <= 0) {
    return MIN_PLAY_MS;
  }
  return Math.min(MIN_PLAY_MS, Math.max(0, durationMs - FULL_PLAY_TOLERANCE_MS));
}
