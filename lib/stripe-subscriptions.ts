import Stripe from "stripe";

// Shared helpers for reading Deals book subscription state off Stripe
// objects. Used by the Stripe webhook and the self-serve plan route.

// Newer Stripe API versions keep the period end on the subscription item;
// older ones keep it on the subscription itself. Read both so the webhook
// behaves the same either way.
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const loose = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts =
    loose.current_period_end ?? loose.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" && ts > 0 ? new Date(ts * 1000) : null;
}

export interface BookSubscriptionState {
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  accessUntil: Date | null;
  cancelAtPeriodEnd: boolean;
}

// Load the subscription and shape it into the fields CouponBookPurchase
// stores. Returns null when Stripe can't be reached or the subscription
// doesn't exist; callers decide their fallback (fulfillment grants the paid
// year anyway, lifecycle sync just skips and logs).
export async function getBookSubscriptionState(
  stripe: Stripe,
  subscriptionId: string,
): Promise<BookSubscriptionState | null> {
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      accessUntil: subscriptionPeriodEnd(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  } catch (err) {
    console.error(`Could not load Stripe subscription ${subscriptionId}:`, err);
    return null;
  }
}
