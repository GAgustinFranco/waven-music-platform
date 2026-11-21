export enum Plan {
  Free = 'free',
  Premium = 'premium',
}

export enum StreamQuality {
  Standard = 'std',
  High = 'high',
}

export interface PlanLimits {
  /** `null` means unlimited. */
  maxPlaylists: number | null;
  streamQuality: StreamQuality;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  [Plan.Free]: { maxPlaylists: 5, streamQuality: StreamQuality.Standard },
  [Plan.Premium]: { maxPlaylists: null, streamQuality: StreamQuality.High },
};

/**
 * Effective plan of a user. Subscriptions arrive with billing (phase 9); until
 * then everyone is on Free.
 */
export function getEffectivePlan(): Plan {
  return Plan.Free;
}
