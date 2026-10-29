// Gist Deals book shared constants + the book access rule.
export const COUPON_BOOK_PRICE_CENTS = 1500; // $15 — per year for new buyers (annual billing since 2026-10-29)

export function couponBookPriceCents(): number {
  return COUPON_BOOK_PRICE_CENTS;
}

// Stripe metadata kind used to route checkout.session.completed events to the
// coupon book fulfillment path.
export const COUPON_BOOK_STRIPE_KIND = "coupon_book";

// Stripe metadata kind for gifted coupon books. Fulfillment creates the
// purchase row for the RECIPIENT's email and sends the gift email.
export const COUPON_BOOK_GIFT_STRIPE_KIND = "coupon_book_gift";

// --- The book access rule (annual billing switch, 2026-10-29) --------------
// A purchase row grants access when either:
//   - it is a lifetime row: every one-time buyer from before the switch
//     (grandfathered forever, per the launch promise) and admin comps, or
//   - its paid-through date (accessUntil) is still in the future. Annual
//     subscribers keep access to the end of the period they paid for, even
//     after cancelling; gift recipients hold one prepaid year.
// Every ownership check (portal, book API, Mini gates, Friday digest,
// redemption) goes through these helpers so the rule can never drift.
export function couponBookAccessWhere() {
  return {
    OR: [{ isLifetime: true }, { accessUntil: { gt: new Date() } }],
  };
}

export function couponBookPurchaseHasAccess(purchase: {
  isLifetime: boolean;
  accessUntil: Date | null;
}): boolean {
  if (purchase.isLifetime) return true;
  return (
    purchase.accessUntil != null &&
    purchase.accessUntil.getTime() > Date.now()
  );
}

// End of one prepaid year starting at `start` (gift purchases: the gift pays
// for the recipient's first year, then they renew or lapse like any annual
// owner).
export function couponBookPrepaidYearEnd(start: Date): Date {
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return end;
}
