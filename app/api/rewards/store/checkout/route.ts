import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { isProductSize } from "@/lib/product-sizes";
import {
  COUPON_BOOK_STRIPE_KIND,
  couponBookPriceCents,
} from "@/lib/coupon-book";
import {
  RewardsError,
  computePointsApplication,
  debitPointsForCheckout,
  getDealsAccess,
  getPointsBalance,
  getRewardConfig,
} from "@/lib/rewards";
import {
  fulfillPointsPaidDealsYear,
  fulfillPointsPaidProduct,
} from "@/lib/rewards-store";

export const dynamic = "force-dynamic";

// POST /api/rewards/store/checkout
// { email, itemType: "product" | "deals", productId?, size?, pointsToApply? }
//
// Buy a storefront item from the rewards portal, spending points as
// money (the workspace's points-per-dollar rate, 100 = $1 by default)
// and paying the cash remainder through the item's normal Stripe
// checkout: the session is the same one /api/products/checkout or
// /api/coupons/checkout creates, plus a one-off Stripe coupon for the
// exact points discount, so the existing webhook fulfillment runs
// unchanged and purchase points are earned on the cash portion only
// (the webhook awards on session.amount_total, which the coupon has
// already reduced).
//
// Points are debited when the session is created (ledger kind "redeem",
// sourceRef = the session id, so a retry can never double-debit). If
// the session expires unpaid, the webhook's expired branch credits them
// back (kind "redeem_refund"). When points cover the whole price there
// is nothing to charge, so no session exists: the purchase is fulfilled
// directly through lib/rewards-store.ts, writing the same rows the
// webhook would have written, with the debit as the payment record.
//
// Identity is the portal's existing pattern: the reader is the active
// subscriber resolved from the submitted email in this workspace, and
// only that reader's ledger can ever be debited: no request field names
// another reader.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const itemType = body.itemType === "deals" ? "deals" : body.itemType === "product" ? "product" : null;
  if (!itemType) {
    return NextResponse.json({ error: "An item is required." }, { status: 400 });
  }
  const requestedPoints =
    typeof body.pointsToApply === "number" && Number.isFinite(body.pointsToApply)
      ? Math.max(0, Math.floor(body.pointsToApply))
      : 0;

  const workspace = await getWorkspace();
  const subscriber = await basePrisma.subscriber.findFirst({
    where: { workspaceId: workspace.id, email, active: true },
    select: { id: true },
  });
  if (!subscriber) {
    return NextResponse.json(
      { error: "We couldn't find an active subscription for that email." },
      { status: 404 }
    );
  }

  // Resolve the item and its price in THIS workspace only.
  let product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    imageUrl: string | null;
    quantity: number | null;
    requiresShipping: boolean;
    offersSizes: boolean;
  } | null = null;
  let priceCents: number;
  let itemName: string;
  if (itemType === "deals") {
    const access = await getDealsAccess(basePrisma, workspace.id, email);
    if (access.isLifetime) {
      return NextResponse.json(
        { error: "You already have lifetime Deals access." },
        { status: 400 }
      );
    }
    priceCents = couponBookPriceCents();
    itemName = `${workspace.name} Deals Book`;
  } else {
    const productId = typeof body.productId === "string" ? body.productId : "";
    product = await basePrisma.product.findFirst({
      where: { id: productId, workspaceId: workspace.id, status: "active" },
      select: {
        id: true,
        name: true,
        slug: true,
        priceCents: true,
        imageUrl: true,
        quantity: true,
        requiresShipping: true,
        offersSizes: true,
      },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (product.quantity !== null) {
      const paid = await basePrisma.productOrder.count({
        where: { workspaceId: workspace.id, productId: product.id, status: "paid" },
      });
      if (paid >= product.quantity) {
        return NextResponse.json({ error: "This product is sold out." }, { status: 400 });
      }
    }
    priceCents = product.priceCents;
    itemName = product.name;
  }

  // Size selection mirrors the public product checkout: a sized product
  // can never start a purchase without one of the fixed sizes.
  let orderSize: string | null = null;
  if (product?.offersSizes) {
    if (!isProductSize(body.size)) {
      return NextResponse.json({ error: "Please choose a size." }, { status: 400 });
    }
    orderSize = body.size;
  }

  const [config, balance] = await Promise.all([
    getRewardConfig(basePrisma, workspace.id),
    getPointsBalance(basePrisma, workspace.id, subscriber.id),
  ]);
  const application = computePointsApplication({
    balance,
    priceCents,
    pointsPerDollar: config.pointsPerDollar,
    requestedPoints,
  });
  const { pointsSpent, discountCents, cashCents } = application;

  // Fully points-paid: no cash to charge, so fulfill directly and never
  // send the reader to Stripe.
  if (pointsSpent > 0 && cashCents === 0) {
    try {
      if (itemType === "deals") {
        const result = await fulfillPointsPaidDealsYear(basePrisma, {
          workspaceId: workspace.id,
          subscriberId: subscriber.id,
          email,
          points: pointsSpent,
        });
        try {
          const { sendCouponBookMagicLinkEmail } = await import("@/lib/coupon-book-email");
          await sendCouponBookMagicLinkEmail({
            workspaceId: workspace.id,
            to: email,
            magicToken: result.magicToken,
          });
        } catch {
          // The year is granted either way; the email is a convenience
          // copy of the link the reader can also reach from /deals.
        }
        return NextResponse.json({
          ok: true,
          pointsPaid: true,
          itemType,
          pointsSpent: result.pointsSpent,
          balanceAfter: result.balanceAfter,
          accessUntil: result.accessUntil,
        });
      }
      const result = await fulfillPointsPaidProduct(basePrisma, {
        workspaceId: workspace.id,
        subscriberId: subscriber.id,
        email,
        productId: product!.id,
        size: orderSize,
        points: pointsSpent,
      });
      return NextResponse.json({
        ok: true,
        pointsPaid: true,
        itemType,
        pointsSpent: result.pointsSpent,
        balanceAfter: result.balanceAfter,
      });
    } catch (error) {
      return rewardsErrorResponse(error);
    }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Payments are not configured right now. Please try again later." },
      { status: 503 }
    );
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const appUrl = await getWorkspaceUrl();

  // The points discount rides the normal checkout as a one-off Stripe
  // coupon for the exact discount amount (the pattern the guide upgrade
  // checkout uses), created fresh per checkout because the amount is
  // different every time. duration "once" means a Deals subscription
  // renews at full price next year; only this purchase is discounted.
  let couponId: string | null = null;
  if (pointsSpent > 0) {
    try {
      const coupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: "usd",
        duration: "once",
        name: "Reader Rewards points",
        metadata: {
          workspaceId: workspace.id,
          purpose: "rewards_points",
          subscriberId: subscriber.id,
        },
      });
      couponId = coupon.id;
    } catch (err) {
      console.error("rewards store coupon error:", err);
      return NextResponse.json(
        { error: "Could not start checkout. Please try again." },
        { status: 502 }
      );
    }
  }
  const pointsMetadata: Record<string, string> =
    pointsSpent > 0
      ? { pointsApplied: String(pointsSpent), subscriberId: subscriber.id }
      : {};

  let session: Stripe.Checkout.Session;
  let orderId: string | null = null;
  try {
    if (itemType === "product" && product) {
      const order = await basePrisma.productOrder.create({
        data: {
          workspaceId: workspace.id,
          productId: product.id,
          email,
          amountCents: cashCents,
          pointsApplied: pointsSpent > 0 ? pointsSpent : null,
          status: "pending_payment",
          size: orderSize,
        },
      });
      orderId = order.id;
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: product.priceCents,
              product_data: {
                name: product.name,
                ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
              },
            },
            quantity: 1,
          },
        ],
        ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
        customer_email: email,
        ...(product.requiresShipping
          ? { shipping_address_collection: { allowed_countries: ["US" as const] } }
          : {}),
        success_url: `${appUrl}/products/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/products/${product.slug}?cancelled=1`,
        metadata: {
          workspaceId: workspace.id,
          kind: "product",
          productId: product.id,
          orderId: order.id,
          email,
          ...(orderSize ? { size: orderSize } : {}),
          ...pointsMetadata,
        },
      });
      await basePrisma.productOrder.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });
    } else {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: priceCents,
              recurring: { interval: "year" },
              product_data: {
                name: itemName,
                description: `$15 a year — new deals every Monday, every guide included`,
              },
            },
            quantity: 1,
          },
        ],
        ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
        customer_email: email,
        success_url: `${appUrl}/deals/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/deals?cancelled=1`,
        metadata: {
          workspaceId: workspace.id,
          kind: COUPON_BOOK_STRIPE_KIND,
          email,
          ...pointsMetadata,
        },
        subscription_data: {
          metadata: {
            workspaceId: workspace.id,
            kind: COUPON_BOOK_STRIPE_KIND,
            email,
          },
        },
      });
    }
  } catch (err) {
    console.error("rewards store checkout stripe error:", err);
    if (orderId) {
      // No session means no payment can ever arrive; drop the pending
      // order so it never lingers as an unpaid row.
      await basePrisma.productOrder
        .delete({ where: { id: orderId } })
        .catch(() => {});
    }
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }

  // Debit the points now that the session exists, keyed to the session
  // id. If the debit cannot land (the balance moved in a race, or a
  // duplicate create), kill the session so the discounted checkout can
  // never be paid without its points.
  if (pointsSpent > 0) {
    try {
      const debited = await debitPointsForCheckout(basePrisma, {
        workspaceId: workspace.id,
        subscriberId: subscriber.id,
        points: pointsSpent,
        sourceRef: session.id,
        note: itemName,
      });
      if (!debited) throw new RewardsError("conflict", "That checkout was already started.");
    } catch (error) {
      await stripe.checkout.sessions.expire(session.id).catch(() => {});
      if (orderId) {
        await basePrisma.productOrder
          .delete({ where: { id: orderId } })
          .catch(() => {});
      }
      return rewardsErrorResponse(error);
    }
  }

  return NextResponse.json({ url: session.url });
}

function rewardsErrorResponse(error: unknown) {
  if (error instanceof RewardsError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 400 }
    );
  }
  if (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2034"
  ) {
    return NextResponse.json(
      { error: "That purchase raced another one. Please refresh and try again.", code: "conflict" },
      { status: 409 }
    );
  }
  console.error("Reader Rewards store checkout failed", error);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}
