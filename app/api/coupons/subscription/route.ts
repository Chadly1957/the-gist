import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";
import {
  getBookSubscriptionState,
  subscriptionPeriodEnd,
} from "@/lib/stripe-subscriptions";

export const dynamic = "force-dynamic";

// Self-serve plan management for annual Deals owners: cancel or resume the
// yearly renewal. Authorized by the same magic token as the book API (the
// token is the reader's portal credential). Cancelling sets Stripe's
// cancel_at_period_end: access continues through the paid-through date,
// which is exactly what the book access rule reads.
export async function POST(req: NextRequest) {
  const { token, action } = await req.json().catch(() => ({}));
  if (!token || (action !== "cancel" && action !== "resume")) {
    return NextResponse.json(
      { error: "Token and a valid action are required." },
      { status: 400 },
    );
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payments are not configured right now." },
      { status: 503 },
    );
  }

  const workspace = await getWorkspace();
  const purchase = await basePrisma.couponBookPurchase.findFirst({
    where: { workspaceId: workspace.id, magicToken: token, active: true },
    select: { id: true, isLifetime: true, stripeSubscriptionId: true },
  });
  if (!purchase) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }
  if (purchase.isLifetime || !purchase.stripeSubscriptionId) {
    // Lifetime rows and prepaid gift years have no Stripe plan to manage.
    return NextResponse.json(
      { error: "This book is not on a renewable plan." },
      { status: 400 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  try {
    const sub = await stripe.subscriptions.update(purchase.stripeSubscriptionId, {
      cancel_at_period_end: action === "cancel",
    });
    const periodEnd = subscriptionPeriodEnd(sub);
    await basePrisma.couponBookPurchase.update({
      where: { id: purchase.id },
      data: {
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        subscriptionStatus: sub.status,
        ...(periodEnd ? { accessUntil: periodEnd } : {}),
      },
    });
    const state = await getBookSubscriptionState(stripe, purchase.stripeSubscriptionId);
    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      status: sub.status,
      accessUntil: (periodEnd ?? state?.accessUntil)?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("coupon subscription manage error:", err);
    return NextResponse.json(
      { error: "Could not update your plan. Please try again." },
      { status: 502 },
    );
  }
}
