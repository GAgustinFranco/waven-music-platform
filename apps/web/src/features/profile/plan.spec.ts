import { describe, expect, it } from 'vitest';
import { describePlan, planName, validateDisplayName } from './plan';

describe('describePlan', () => {
  const free = { maxPlaylists: 5, streamQuality: 'high', themes: false } as const;
  const premium = { maxPlaylists: null, streamQuality: 'high', themes: true } as const;

  it('shows the Free usage against the cap', () => {
    expect(describePlan(free, 3)).toEqual({
      playlists: { label: 'Playlists', value: '3 of 5', ratio: 0.6 },
      themes: 'Classic only',
      atLimit: false,
    });
  });

  it('flags the limit and clamps the meter after a downgrade', () => {
    const plan = describePlan(free, 7);
    expect(plan.atLimit).toBe(true);
    expect(plan.playlists).toEqual({ label: 'Playlists', value: '7 of 5', ratio: 1 });
  });

  it('has no meter for Premium', () => {
    expect(describePlan(premium, 12)).toEqual({
      playlists: { label: 'Playlists', value: '12 (unlimited)', ratio: null },
      themes: 'All themes',
      atLimit: false,
    });
  });

  it('falls back to the limit while the count is unknown', () => {
    expect(describePlan(free, null).playlists).toEqual({
      label: 'Playlists',
      value: 'Up to 5',
      ratio: null,
    });
    expect(describePlan(premium, null).playlists.value).toBe('Unlimited');
  });
});

describe('planName', () => {
  it('names both plans', () => {
    expect(planName('free')).toBe('Free');
    expect(planName('premium')).toBe('Premium');
  });
});

describe('validateDisplayName', () => {
  it('accepts a trimmed name of 1–50 characters', () => {
    expect(validateDisplayName('  Ada  ')).toBeNull();
    expect(validateDisplayName('a'.repeat(50))).toBeNull();
  });

  it('rejects blank and too long names', () => {
    expect(validateDisplayName('   ')).toMatch(/empty/);
    expect(validateDisplayName('a'.repeat(51))).toMatch(/50 characters/);
  });
});
