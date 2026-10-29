import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";
import {
  MINI_UPGRADE_STRIPE_KIND,
  UPGRADE_PRICE_CENTS,
  getMiniAccessProfile,
} from "@/lib/minis";
import { COUPON_BOOK_PRICE_CENTS } from "@/lib/coupon-book";

export const dynamic = "force-dynamic";

// The $5 guide credit is a reusable $5-off-once Stripe coupon, created once
// per workspace and remembered in Settings. Applied to the upgrade's
// subscription checkout, it takes the first year from $15 to $10; renewals
// bill the full $15 because the coupon's duration is "once".
const CREDIT_COUPON_SETTING_KEY = "deals_upgrade_credit_coupon_id";
const CREDIT_CENTS = COUPON_BOOK_PRICE_CENTS - UPGRADE_PRICE_CENTS; // $5

async function getCreditCouponId(stripe: Stripe, workspaceId: string): Promise<string> {
  const row = await basePrisma.setting.findFirst({
    where: { workspaceId, key: CREDIT_COUPON_SETTING_KEY },
    select: { id: true, value: true },
  });
  if (row?.value) {
    try {
      const existing = (await stripe.coupons.retrieve(row.value)) as Stripe.Coupon & {
        deleted?: boolean;
      };
      if (!existing.deleted && existing.valid) return existing.id;
    } catch {
      // Stored coupon is gone or unreadable; recreate it below.
    }
  }
  const coupon = await stripe.coupons.create({
    amount_off: CREDIT_CENTS,
    currency: "usd",
    duration: "once",
    name: "Guide upgrade credit",
    metadata: { workspaceId, purpose: "mini_upgrade_credit" },
  });
  if (row) {
    await basePrisma.setting.update({ where: { id: row.id }, data: { value: coupon.id } });
  } else {
    await basePrisma.setting.create({
      data: { workspaceId, key: CREDIT_COUPON_SETTING_KEY, value: coupon.id },
    });
  }
  return coupon.id;
}

// Start Stripe Checkout for the upgrade to the full Deals book (Option B:
// flat $5 off, no stacking). Since the annual switch (2026-10-29) the
// upgrade is a $15/year subscription with the $5 guide credit applied to
// year one, so the buyer pays $10 for the first year, then $15/year.
// Eligibility is enforced here, not just in the UI: only Mini owners
// without Deals may upgrade.
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments are not configured right now. Please try again later." }, { status: 503 });
  }

  const workspace = await getWorkspace();
  const profile = await getMiniAccessProfile(workspace.id, normalizedEmail);
  if (profile.hasDeals) {
    return NextResponse.json(
      { error: "You already have the full Deals book." },
      { status: 409 },
    );
  }
  if (profile.ownedMiniIds.length === 0) {
    return NextResponse.json(
      { error: "Pick up a guide first, then upgrade from there." },
      { status: 409 },
    );
  }

  // Send a cancelled checkout back to their portal when we can.
  const latestMini = await basePrisma.miniPurchase.findFirst({
    where: { workspaceId: workspace.id, email: normalizedEmail },
    orderBy: { createdAt: "desc" },
    select: { magicToken: true },
  });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const appUrl = await getWorkspaceUrl();

  let session;
  try {
    const couponId = await getCreditCouponId(stripe, workspace.id);
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: COUPON_BOOK_PRICE_CENTS,
            recurring: { interval: "year" },
            product_data: {
              name: `${workspace.name} Deals Book`,
              description:
                "Full Deals book — $10 for your first year (your $5 guide credit applied), then $15 a year",
            },
          },
          quantity: 1,
        },
      ],
      discounts: [{ coupon: couponId }],
      customer_email: normalizedEmail,
      success_url: `${appUrl}/deals/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: latestMini
        ? `${appUrl}/deals?token=${latestMini.magicToken}&cancelled=1`
        : `${appUrl}/deals?cancelled=1`,
      metadata: {
        workspaceId: workspace.id,
        kind: MINI_UPGRADE_STRIPE_KIND,
        email: normalizedEmail,
        miniPurchaseIds: profile.ownedMiniIds.join(","),
      },
      subscription_data: {
        metadata: {
          workspaceId: workspace.id,
          kind: MINI_UPGRADE_STRIPE_KIND,
          email: normalizedEmail,
        },
      },
    });
  } catch (err) {
    console.error("mini upgrade checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
