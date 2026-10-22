import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { recordPaidProductOrder, shippingFromSession } from "@/lib/products";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// POST /api/admin/products/[id]/sync-payment-link
// Pulls every completed, paid checkout session from the product's legacy
// Stripe Payment Link and records any that are missing as paid orders.
// The webhook keeps this current going forward; this endpoint is the
// backfill and catch-up tool.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }
  const { id } = await params;
  const product = await basePrisma.product.findUnique({
    where: { id },
    select: { id: true, workspaceId: true, stripePaymentLinkId: true },
  });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  if (!product.stripePaymentLinkId) {
    return NextResponse.json({ error: "This product has no Payment Link ID set." }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let imported = 0;
  let seen = 0;
  let startingAfter: string | undefined;
  // Page through the link's sessions (cap 5 pages = 500 sessions).
  for (let page = 0; page < 5; page++) {
    const list = await stripe.checkout.sessions.list({
      payment_link: product.stripePaymentLinkId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const s of list.data) {
      if (s.status !== "complete" || s.payment_status !== "paid") continue;
      seen++;
      const email = (s.customer_details?.email || "").trim().toLowerCase();
      if (!email) continue;
      const { created } = await recordPaidProductOrder(basePrisma, {
        workspaceId: product.workspaceId,
        productId: product.id,
        email,
        amountCents: s.amount_total ?? 0,
        sessionId: s.id,
        paidAt: new Date(s.created * 1000),
        // The link collected shipping addresses; store them on new orders
        // and backfill them onto orders recorded before addresses were kept.
        shipping: shippingFromSession(s),
      });
      if (created) imported++;
    }
    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data[list.data.length - 1].id;
  }

  const paidTotal = await basePrisma.productOrder.count({
    where: { productId: product.id, status: "paid" },
  });
  return NextResponse.json({ ok: true, imported, seen, paidTotal });
}
