// Client-safe Starred Community Board constants (no database imports
// here, so form pages can import these without bundling Prisma into
// browser code). Server code (the starred checkout route) holds the
// locked cap-check transaction; see lib/sponsor-weeks.ts withWeekLock
// for the pattern it mirrors.

export const STARRED_PRICE_CENTS = 3999;
export const STARRED_MAX_SPOTS = 5;

// Statuses that occupy one of the 5 starred spots: a pending checkout
// holds its spot until the session expires, a past-due spot keeps
// showing while Stripe retries, and a cancelled-at-period-end spot is
// still `active` until its paid month ends.
export const STARRED_LIVE_STATUSES = ["pending_payment", "active", "past_due"] as const;

// Statuses that render in the Community Partners block.
export const STARRED_SHOWING_STATUSES = ["active", "past_due"] as const;

export function starredPriceLabel(): string {
  return "$39.99/mo";
}
