// Gist Coupon Book MVP shared constants.
export const COUPON_BOOK_PRICE_CENTS = 1500; // $15 one-time purchase, yours for life

export function couponBookPriceCents(): number {
  return COUPON_BOOK_PRICE_CENTS;
}

// Stripe metadata kind used to route checkout.session.completed events to the
// coupon book fulfillment path.
export const COUPON_BOOK_STRIPE_KIND = "coupon_book";
