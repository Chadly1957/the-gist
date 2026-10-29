import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { withWorkspace } from "@/lib/workspace";
import Stripe from "stripe";
import { alertBookingFailureOnce } from "@/lib/sponsor-booking-alerts";
import { recordPaidProductOrder, shippingFromSession } from "@/lib/products";
import { isProductSize } from "@/lib/product-sizes";

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

// Board posts: the checkout route creates the BoardPost row as
// pending_payment; fulfillment flips it to pending_approval (the 7-day run
// starts only when an admin approves). Idempotent: re-delivered events no-op.
async function fulfillBoardPost(workspaceId: string, session: Stripe.Checkout.Session) {
  const paidAt = new Date();
  const postId = session.metadata?.boardPostId;
  const existing = postId
    ? await basePrisma.boardPost.findFirst({
        where: { id: postId, workspaceId },
        select: { id: true, status: true },
      })
    : await basePrisma.boardPost.findFirst({
        where: { stripeSessionId: session.id },
        select: { id: true, status: true },
      });
  if (existing && existing.status === "pending_payment") {
    await basePrisma.boardPost.update({
      where: { id: existing.id },
      data: {
        status: "pending_approval",
        paidAt,
        stripeSessionId: session.id,
        stripePaymentIntent:
          typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      },
    });
  }
}

// Product orders: the checkout route creates the ProductOrder row as
// pending_payment; fulfillment just flips it to paid. Idempotent: re-delivered
// events no-op. If the pending row is missing (edge case), create it from
// session metadata so a captured payment never goes unrecorded.
async function fulfillProductOrder(workspaceId: string, session: Stripe.Checkout.Session) {
  const paidAt = new Date();
  // Shipping address collected at checkout (physical products); null for
  // digital products or sessions that collected none.
  const shipping = shippingFromSession(session);
  // Apparel size from the checkout session metadata, when the product
  // offered sizes. The pending order row normally already carries it (the
  // checkout route stored it); this is the backfill for a missing row.
  const rawSize = session.metadata?.size;
  const sizeFromMeta = isProductSize(rawSize) ? rawSize : null;
  const existing = await basePrisma.productOrder.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true, status: true, size: true },
  });
  if (existing) {
    const sizeFill: { size?: string } = !existing.size && sizeFromMeta ? { size: sizeFromMeta } : {};
    if (existing.status !== "paid") {
      await basePrisma.productOrder.update({
        where: { id: existing.id },
        data: { status: "paid", paidAt, ...(shipping ?? {}), ...sizeFill },
      });
    } else if (shipping || sizeFill.size) {
      // Redelivery after the flip: backfill the address or size if missing.
      await basePrisma.productOrder.update({
        where: { id: existing.id },
        data: { ...(shipping ?? {}), ...sizeFill },
      });
    }
    return;
  }
  const productId = session.metadata?.productId;
  const email = (session.customer_details?.email || session.metadata?.email || "").trim().toLowerCase();
  if (!productId || !email) {
    console.error(`Product payment captured but order row missing and metadata incomplete for session ${session.id}`);
    return;
  }
  await basePrisma.productOrder.create({
    data: {
      workspaceId,
      productId,
      email,
      amountCents: session.amount_total ?? 0,
      stripeSessionId: session.id,
      status: "paid",
      paidAt,
      ...(shipping ?? {}),
      ...(sizeFromMeta ? { size: sizeFromMeta } : {}),
    },
  });
}

// Legacy Payment Link sales: sessions bought through a standalone Stripe
// Payment Link carry no workspace/product metadata, but the session names
// its link (session.payment_link). When a product has claimed that link ID
// (Product.stripePaymentLinkId), the sale files under that product in that
// product's workspace. Returns true when the link is claimed (handled),
// false when no product claims it (caller falls through to normal handling).
async function fulfillPaymentLinkOrder(session: Stripe.Checkout.Session): Promise<boolean> {
  const linkId =
    typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;
  if (!linkId) return false;
  const product = await basePrisma.product.findFirst({
    where: { stripePaymentLinkId: linkId },
    select: { id: true, workspaceId: true },
  });
  if (!product) return false;
  if (session.payment_status !== "paid") return true; // claimed, but nothing paid yet
  const email = (session.customer_details?.email || session.metadata?.email || "").trim().toLowerCase();
  if (!email) {
    console.error(`Payment Link product payment captured but no email for session ${session.id}`);
    return true;
  }
  await recordPaidProductOrder(basePrisma, {
    workspaceId: product.workspaceId,
    productId: product.id,
    email,
    amountCents: session.amount_total ?? 0,
    sessionId: session.id,
    paidAt: new Date(),
    // The legacy Decatur-opoly link required a shipping address at
    // checkout, so these sessions carry one; store it for fulfillment.
    shipping: shippingFromSession(session),
  });
  return true;
}

// Guide purchase: the checkout route never creates the row; fulfillment
// does, so a captured payment never goes unrecorded. Idempotent: a
// re-delivered event reuses the row by session id.
async function fulfillMiniPurchase(workspaceId: string, session: Stripe.Checkout.Session) {
  const email = (session.customer_details?.email || session.metadata?.email || "").trim().toLowerCase();
  const miniId = session.metadata?.miniId || "";
  if (!email || !email.includes("@") || !miniId) {
    console.error(`Guide payment captured but metadata incomplete for session ${session.id}`);
    return;
  }
  const mini = await basePrisma.mini.findFirst({
    where: { id: miniId, workspaceId },
    select: { title: true, slug: true },
  });
  if (!mini) {
    console.error(`Guide payment captured but no guide ${miniId} in workspace ${workspaceId} for session ${session.id}`);
    return;
  }
  const purchase = await basePrisma.miniPurchase.upsert({
    where: { stripeSessionId: session.id },
    update: {},
    create: { workspaceId, email, miniId, stripeSessionId: session.id },
  });
  const { sendMiniMagicLinkEmail } = await import("@/lib/coupon-book-email");
  await sendMiniMagicLinkEmail({
    workspaceId,
    to: email,
    magicToken: purchase.magicToken,
    miniTitle: mini.title,
    miniSlug: mini.slug,
  });
}

// Upgrade to the full Deals book (flat $10, Option B). A re-delivered event
// for the same session just resends the link; only a genuinely different
// session for an email that already owns Deals is flagged for manual refund.
async function fulfillMiniUpgrade(workspaceId: string, session: Stripe.Checkout.Session) {
  const email = (session.customer_details?.email || session.metadata?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error(`Guide upgrade payment captured but no email for session ${session.id}`);
    return;
  }
  const sameSession = await basePrisma.couponBookPurchase.findUnique({
    where: { stripeSessionId: session.id },
    select: { magicToken: true },
  });
  if (sameSession) {
    const { sendCouponBookMagicLinkEmail } = await import("@/lib/coupon-book-email");
    await sendCouponBookMagicLinkEmail({ workspaceId, to: email, magicToken: sameSession.magicToken });
    return;
  }
  const existing = await basePrisma.couponBookPurchase.findFirst({
    where: { workspaceId, email, active: true },
    select: { magicToken: true },
  });
  if (existing) {
    console.error(`Guide upgrade payment captured but Deals purchase already exists for ${email} in ${workspaceId}; flagging session ${session.id} for manual refund.`);
    const { sendCouponBookMagicLinkEmail } = await import("@/lib/coupon-book-email");
    await sendCouponBookMagicLinkEmail({ workspaceId, to: email, magicToken: existing.magicToken });
    return;
  }
  const purchase = await basePrisma.couponBookPurchase.upsert({
    where: { stripeSessionId: session.id },
    update: { active: true, email },
    create: { workspaceId, email, stripeSessionId: session.id, active: true },
  });
  // Record-keeping: the consumed guide credits can never be spent twice.
  // Gating checks hasDeals first anyway, so this flag is belt and braces.
  await basePrisma.miniPurchase.updateMany({
    where: { workspaceId, email, upgradedAt: null },
    data: { upgradedAt: new Date() },
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

  // Legacy Payment Link sales carry no metadata; route them by link ID to
  // the product that claimed the link before the fail-closed check below.
  if (event.type === "checkout.session.completed" && !session.metadata?.workspaceId && session.payment_link) {
    const handled = await fulfillPaymentLinkOrder(session);
    if (handled) return NextResponse.json({ received: true, paymentLinkProduct: true });
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
    } else if (session.metadata?.kind === "product") {
      await fulfillProductOrder(workspaceId, session);
    } else if (session.metadata?.kind === "board_post") {
      await fulfillBoardPost(workspaceId, session);
    } else if (session.metadata?.kind === "deals_mini") {
      await fulfillMiniPurchase(workspaceId, session);
    } else if (session.metadata?.kind === "coupon_book_upgrade") {
      await fulfillMiniUpgrade(workspaceId, session);
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
