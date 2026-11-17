// Client-safe Premium Directory Placement constants (no database imports
// here, so form pages can import these without bundling Prisma into
// browser code). Spots are unlimited by design: there is no max-spots
// constant and no availability route.

export const PREMIUM_PRICE_CENTS = 1999;

// Statuses that occupy a premium subscription on a listing: a pending
// checkout holds its row until the session expires, a past-due spot keeps
// showing while Stripe retries, and a cancelled-at-period-end spot is
// still `active` until its paid month ends.
export const PREMIUM_LIVE_STATUSES = ["pending_payment", "active", "past_due"] as const;

// Statuses that render in the Premium Partners section on /partners.
export const PREMIUM_SHOWING_STATUSES = ["active", "past_due"] as const;

export function premiumPriceLabel(): string {
  return "$19.99/mo";
}
