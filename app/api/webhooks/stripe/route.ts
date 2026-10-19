import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
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

async function fulfillCouponBookGift(workspaceId: string, session: Stripe.Checkout.Session) {
  // The recipient's email is in metadata (set by gift-checkout). The buyer
  // paid on their own email, which Stripe receipts automatically.
  const email = (session.metadata?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error(`Coupon book gift payment captured but no recipient email for session ${session.id}`);
    return;
  }
  // Idempotent: the same session completing twice reuses the purchase row.
  const purchase = await basePrisma.couponBookPurchase.upsert({
    where: { stripeSessionId: session.id },
    update: { active: true, email },
    create: { workspaceId, email, stripeSessionId: session.id, active: true },
  });
  const { sendCouponBookGiftEmail } = await import("@/lib/coupon-book-email");
  await sendCouponBookGiftEmail({
    workspaceId,
    to: email,
    magicToken: purchase.magicToken,
    gifterName: (session.metadata?.gifterName || "").trim(),
    gifterEmail: (session.metadata?.gifterEmail || "").trim(),
    giftMessage: (session.metadata?.giftMessage || "").trim(),
  });
}

// Presenting Partnership lifecycle: invoice.paid activates, invoice.payment_failed
// flags past_due, subscription deleted/cancelled marks cancelled. Returns true
// when the event belonged to a partnership (handled), false to fall through.
async function handlePartnershipEvent(event: Stripe.Event): Promise<boolean> {
  const obj = event.data.object as
    | Stripe.Invoice
    | Stripe.Subscription;
  const subscriptionId =
    "subscription" in obj && typeof obj.subscription === "string"
      ? obj.subscription
      : "id" in obj && event.type.startsWith("customer.subscription")
        ? (obj as Stripe.Subscription).id
        : null;
  if (!subscriptionId) return false;

  const partnership = await basePrisma.presentingPartnership.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!partnership) return false;

  if (event.type === "invoice.paid") {
    await basePrisma.presentingPartnership.update({
      where: { id: partnership.id },
      data: { status: "active" },
    });
  } else if (event.type === "invoice.payment_failed") {
    await basePrisma.presentingPartnership.update({
      where: { id: partnership.id },
      data: { status: "past_due" },
    });
    console.error(
      `Presenting Partnership payment failed: ${partnership.businessName} (${partnership.email}), subscription ${subscriptionId}`
    );
  } else if (event.type === "customer.subscription.deleted") {
    await basePrisma.presentingPartnership.update({
      where: { id: partnership.id },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
  } else if (event.type === "customer.subscription.updated") {
    const sub = obj as Stripe.Subscription;
    const status =
      sub.status === "active" || sub.status === "trialing"
        ? "active"
        : sub.status === "past_due"
          ? "past_due"
          : sub.status === "canceled"
            ? "cancelled"
            : partnership.status;
    await basePrisma.presentingPartnership.update({
      where: { id: partnership.id },
      data: { status },
    });
  }
  return true;
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

  // Presenting Partnership subscription/invoice events are workspace-agnostic
  // (one partnership can span both cities), so handle them before the
  // workspaceId fail-closed check below.
  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const handled = await handlePartnershipEvent(event);
    if (handled) return NextResponse.json({ received: true, partnership: true });
    // Not a partnership event: fall through to normal handling.
  }

  const workspaceId = session.metadata?.workspaceId;
  if (!workspaceId) {
    // Fail closed: never silently attribute a purchase (and its magic-link
    // book email) to the default workspace when the checkout metadata is
    // missing. Every checkout session must carry metadata.workspaceId.
    console.error(
      `Stripe webhook: missing metadata.workspaceId on session ${sessionId} (${event.type}); skipping fulfillment.`
    );
    return NextResponse.json({ ok: true, skipped: "missing workspace metadata" });
  }

  if (event.type === "checkout.session.completed") {
    const approvedAt = new Date();
    if (session.metadata?.kind === "sponsor_week") {
      await fulfillWeekBooking(workspaceId, session);
    } else if (session.metadata?.kind === "coupon_book") {
      await fulfillCouponBookPurchase(workspaceId, session);
    } else if (session.metadata?.kind === "coupon_book_gift") {
      await fulfillCouponBookGift(workspaceId, session);
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
