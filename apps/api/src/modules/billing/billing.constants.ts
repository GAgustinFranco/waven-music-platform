/** SPEC §2: Premium costs ARS 2,999 per month (major units). */
export const PREMIUM_PRICE = { amount: 2999, currency: 'ARS' } as const;

/** Days of Premium bought by one payment in `onetime` mode (business rule 8). */
export const PREMIUM_PERIOD_DAYS = 30;

export const PREMIUM_TITLE = 'Waven Premium';
