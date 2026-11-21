import type { Me } from '@/lib/api/client';

export const DISPLAY_NAME_MAX = 50;

export interface PlanUsage {
  label: string;
  /** "3 of 5", "7 (unlimited)"… */
  value: string;
  /** 0–1 when the plan caps it, for a meter; null when unlimited. */
  ratio: number | null;
}

const QUALITY_LABEL: Record<Me['limits']['streamQuality'], string> = {
  std: 'Standard (128 kbps)',
  high: 'High (320 kbps)',
};

export const planName = (plan: Me['plan']) => (plan === 'premium' ? 'Premium' : 'Free');

/** What the plan allows and how much of it is used (SPEC §2), for the profile page. */
export function describePlan(limits: Me['limits'], playlistCount: number | null) {
  const max = limits.maxPlaylists;
  const used = playlistCount ?? 0;
  const playlists: PlanUsage =
    max === null
      ? {
          label: 'Playlists',
          value: playlistCount === null ? 'Unlimited' : `${used} (unlimited)`,
          ratio: null,
        }
      : {
          label: 'Playlists',
          value: playlistCount === null ? `Up to ${max}` : `${used} of ${max}`,
          ratio: playlistCount === null ? null : Math.min(used / max, 1),
        };
  return {
    playlists,
    quality: QUALITY_LABEL[limits.streamQuality],
    atLimit: max !== null && playlistCount !== null && used >= max,
  };
}

/** Client-side mirror of `UpdateMeDto`: trimmed, 1–50 characters. */
export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Your display name can’t be empty.';
  }
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return `Use ${DISPLAY_NAME_MAX} characters or fewer.`;
  }
  return null;
}
