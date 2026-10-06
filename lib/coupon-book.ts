// Gist Coupon Book MVP shared constants.
export const COUPON_BOOK_FOUNDING_CENTS = 1000; // $10 founding pre-sale
export const COUPON_BOOK_REGULAR_CENTS = 1500; // $15 regular
export const COUPON_BOOK_LAUNCH_LABEL = "October 15";
// Founding price is available through Oct 15 (Central). Server and client
// both derive the current price from this cutoff so the button always matches.
export const COUPON_BOOK_FOUNDING_CUTOFF_ISO = "2026-10-16T05:00:00Z";

export function couponBookIsFounding(now: Date = new Date()): boolean {
  return now.getTime() < Date.parse(COUPON_BOOK_FOUNDING_CUTOFF_ISO);
}

export function couponBookPriceCents(now: Date = new Date()): number {
  return couponBookIsFounding(now) ? COUPON_BOOK_FOUNDING_CENTS : COUPON_BOOK_REGULAR_CENTS;
}

// Stripe metadata kind used to route checkout.session.completed events to the
// coupon book fulfillment path. Chad's manual Stripe payment link for the
// pre-sale must carry metadata kind=coupon_book and workspaceId=<workspace>.
export const COUPON_BOOK_STRIPE_KIND = "coupon_book";
