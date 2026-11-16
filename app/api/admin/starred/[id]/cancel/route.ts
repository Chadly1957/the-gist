import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// POST /api/admin/starred/[id]/cancel
// Cancels a Starred Community Board subscription at the end of its paid
// month (cancel_at_period_end): the spot keeps showing through
// currentPeriodEnd, then the subscription is deleted and the webhook
// marks the row cancelled. No proration, no refund. The listing itself
// stays as a free rotating listing; only the subscription ends.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sub = await basePrisma.starredBoardSubscription.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ error: "Starred subscription not found." }, { status: 404 });
  if (sub.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }
  if (sub.cancelAtPeriodEnd) {
    return NextResponse.json({ ok: true, alreadyCancelling: true });
  }

  if (sub.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    try {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Stripe cancel failed";
      // If Stripe says it's already cancelled, treat as success; otherwise surface.
      if (!/no such subscription|canceled/i.test(msg)) {
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
  }

  await basePrisma.starredBoardSubscription.update({
    where: { id },
    data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
