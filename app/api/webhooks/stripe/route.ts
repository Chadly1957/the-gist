import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";
import { withWorkspace } from "@/lib/workspace";
import Stripe from "stripe";
import { alertBookingFailureOnce } from "@/lib/sponsor-booking-alerts";

export const dynamic = "force-dynamic";

async function fulfillWeekBooking(workspaceId: string, session: Stripe.Checkout.Session) {
  const booking = await basePrisma.sponsorWeekBooking.findFirst({
    where: { workspaceId, stripeSessionId: session.id },
    include: { week: { select: { weekStart: true } }, sponsor: { select: { magicToken: true } } },
  });

  const { getWorkspaceUrl } = await import("@/lib/workspace");
  const workspace = await basePrisma.workspace.findUnique({ where: { id: workspaceId } });
  const appUrl = workspace ? await withWorkspace(workspace, () => getWorkspaceUrl()) : "";

  if (!booking) {
    // The booking row is missing but Stripe says payment completed. This can
    // happen if checkout.session.expired was processed out of order and
    // deleted the pending row. Money is captured with no booking: alert loudly.
    if (session.payment_status === "paid") {
      console.error(`Sponsor week payment captured but no booking row for session ${session.id}`);
      await alertBookingFailureOnce(
        workspaceId,
        {
          id: session.id,
          businessName: session.customer_details?.name || "Unknown business",
          tier: session.metadata?.tier || "standard",
          weekStart: session.metadata?.weekStart || "",
          amountCents: session.amount_total ?? 0,
          contactName: session.customer_details?.name || "",
          email: session.customer_details?.email || "",
          fulfillmentAlertSentAt: null,
        },
        `Stripe reports payment captured for checkout session ${session.id}, but no matching sponsor week booking exists. The slot was never locked and no ad was placed.`,
        `${appUrl}/admin/sponsors?tab=weekly`,
      );
    }
    return;
  }

  const { fulfillPaidWeekBooking } = await import("@/lib/sponsor-week-fulfillment");
  await fulfillPaidWeekBooking(workspaceId, booking);
}

async function fulfillCouponBookPurchase(workspaceId: string, session: Stripe.Checkout.Session) {
  const email = (session.customer_details?.email || session.metadata?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    // Money is captured but we have no address to deliver the book to.
    console.error(`Coupon book payment captured but no email for session ${session.id}`);
    return;
  }
  // Idempotent: the same session completing twice reuses the purchase row.
  const purchase = await basePrisma.couponBookPurchase.upsert({
    where: { stripeSessionId: session.id },
    update: { active: true, email },
    create: { workspaceId, email, stripeSessionId: session.id, active: true },
  });
  const { sendCouponBookMagicLinkEmail } = await import("@/lib/coupon-book-email");
  await sendCouponBookMagicLinkEmail({ workspaceId, to: email, magicToken: purchase.magicToken });
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const workspaceId = session.metadata?.workspaceId || DEFAULT_WORKSPACE_ID;

  if (event.type === "checkout.session.completed") {
    const approvedAt = new Date();
    if (session.metadata?.kind === "sponsor_week") {
      await fulfillWeekBooking(workspaceId, session);
    } else if (session.metadata?.kind === "coupon_book") {
      await fulfillCouponBookPurchase(workspaceId, session);
    } else {
      await basePrisma.adBooking.updateMany({
        where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
        data: { isPaid: true, status: "approved", approvedAt },
      });
    }
    await basePrisma.tip.updateMany({
      where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
      data: { status: "paid", paidAt: approvedAt },
    });
  }

  if (event.type === "checkout.session.expired") {
    await basePrisma.sponsorWeekBooking.deleteMany({
      where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
    });
    await basePrisma.adBooking.deleteMany({
      where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
    });
    await basePrisma.tip.deleteMany({
      where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
    });
  }

  return NextResponse.json({ received: true });
}
