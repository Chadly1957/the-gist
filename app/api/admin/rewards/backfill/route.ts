import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import {
  backfillRewards,
  type DealsSessionResolution,
} from "@/lib/rewards";

export const dynamic = "force-dynamic";

// POST /api/admin/rewards/backfill
// Launch backfill for the CURRENT workspace: credit readers for the
// purchases and referrals they made before Reader Rewards existed, at
// the workspace's current configured rates. Triggered by the button in
// Admin > Settings > Reader Rewards; never runs on its own. Safe to run
// more than once: the ledger's idempotency keys mean a second run
// creates nothing new (see backfillRewards in lib/rewards.ts).
//
// Deals purchases need their original Stripe checkout session to mirror
// the live award exactly (the purchase row stores neither the amount
// nor, for a gift, the buyer), so each session is resolved here with
// the same rules the webhook's award block uses: only paid sessions of
// kind coupon_book / coupon_book_upgrade / coupon_book_gift count, and
// for a gift the buyer (gifter) earns, never the recipient.
export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  const { id: workspaceId } = await getWorkspace();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const resolveDealsSession = async (
    sessionId: string
  ): Promise<DealsSessionResolution | null> => {
    let checkout: Stripe.Checkout.Session;
    try {
      checkout = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      return null;
    }
    const kind = checkout.metadata?.kind;
    if (
      kind !== "coupon_book" &&
      kind !== "coupon_book_upgrade" &&
      kind !== "coupon_book_gift"
    ) {
      return null;
    }
    if (checkout.payment_status !== "paid") return null;
    const buyerEmail =
      kind === "coupon_book_gift"
        ? checkout.customer_details?.email || checkout.metadata?.gifterEmail || ""
        : checkout.customer_details?.email || checkout.metadata?.email || "";
    if (!buyerEmail) return null;
    return { buyerEmail, amountCents: checkout.amount_total ?? 0 };
  };

  const result = await backfillRewards(basePrisma, {
    workspaceId,
    resolveDealsSession,
  });
  return NextResponse.json({ ok: true, ...result });
}
