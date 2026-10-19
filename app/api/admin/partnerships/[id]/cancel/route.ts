import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// POST /api/admin/partnerships/[id]/cancel
// Cancels the Stripe subscription immediately with proration (30-day terms:
// unused full months are refunded via prorated credit). Marks local row cancelled.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const partnership = await basePrisma.presentingPartnership.findUnique({ where: { id } });
  if (!partnership) return NextResponse.json({ error: "Partnership not found." }, { status: 404 });
  if (partnership.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  if (partnership.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    try {
      await stripe.subscriptions.cancel(partnership.stripeSubscriptionId, {
        prorate: true,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Stripe cancel failed";
      // If Stripe says it's already cancelled, treat as success; otherwise surface.
      if (!/no such subscription|canceled/i.test(msg)) {
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
  }

  await basePrisma.presentingPartnership.update({
    where: { id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
