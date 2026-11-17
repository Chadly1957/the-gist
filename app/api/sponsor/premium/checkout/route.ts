import { getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";
import { PREMIUM_LIVE_STATUSES, PREMIUM_PRICE_CENTS } from "@/lib/premium-directory";

export const dynamic = "force-dynamic";

// POST /api/sponsor/premium/checkout { token, spotlightId }
// Creates a pending PremiumDirectorySubscription, then a Stripe Checkout
// session for the $19.99/mo subscription. The webhook flips the row to
// active on checkout.session.completed; the listing shows at the top of
// the Partners directory (/partners) from that moment. Spots are
// unlimited: no cap check, no workspace row lock. The listing must be
// approved or active: the free signup creates it as active (instant
// acceptance), portal-created listings are pending until an admin
// approves them.
export async function POST(req: NextRequest) {
  const { token, spotlightId } = await req.json().catch(() => ({}));
  if (!token || !spotlightId) {
    return NextResponse.json({ error: "Token and listing ID required." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments are not configured right now. Please try again later." }, { status: 503 });
  }

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const listing = await prisma.spotlightListing.findFirst({
    where: { id: spotlightId, sponsorId: profile.id },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (listing.status !== "approved" && listing.status !== "active") {
    return NextResponse.json(
      { error: "This listing is still waiting for approval before it can go premium." },
      { status: 409 }
    );
  }

  const workspaceId = profile.workspaceId;
  const businessName = profile.businessName;

  // Existing-live check + pending-row creation inside one transaction.
  // The partial unique index in the migration is the backstop for one
  // listing holding two live subscriptions.
  let sub;
  try {
    sub = await basePrisma.$transaction(async (tx) => {
      const existing = await tx.premiumDirectorySubscription.findFirst({
        where: { workspaceId, spotlightId, status: { in: [...PREMIUM_LIVE_STATUSES] } },
      });
      if (existing) {
        throw new Error("This listing already has a Premium subscription.");
      }
      return tx.premiumDirectorySubscription.create({
        data: {
          workspaceId,
          spotlightId,
          sponsorId: profile.id,
          status: "pending_payment",
          monthlyAmountCents: PREMIUM_PRICE_CENTS,
        },
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start checkout.";
    if (msg === "This listing already has a Premium subscription.") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("premium checkout failed:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  // Reuse the Stripe customer when this sponsor has bought premium before
  // (the id lives on the subscription row; SponsorProfile carries none),
  // so a repeat buyer keeps one Stripe customer. Otherwise Checkout
  // creates the customer from the profile email. No cross-table lookup:
  // a sponsor who starred before but never bought premium gets a new
  // Stripe customer from Checkout.
  const prior = await basePrisma.premiumDirectorySubscription.findFirst({
    where: { sponsorId: profile.id, stripeCustomerId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { stripeCustomerId: true },
  });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const appUrl = await getWorkspaceUrl();

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: PREMIUM_PRICE_CENTS,
            recurring: { interval: "month" },
            product_data: { name: `Premium Directory — ${businessName}` },
          },
          quantity: 1,
        },
      ],
      ...(prior?.stripeCustomerId
        ? { customer: prior.stripeCustomerId }
        : { customer_email: profile.email }),
      success_url: `${appUrl}/sponsor/success?premium=1`,
      cancel_url: `${appUrl}/sponsor/portal?token=${profile.magicToken}`,
      metadata: {
        workspaceId,
        kind: "premium_directory",
        spotlightId,
        sponsorId: profile.id,
        businessName,
      },
      // The subscription carries the same routing metadata so lifecycle
      // events stay attributable even without the session.
      subscription_data: {
        metadata: {
          workspaceId,
          kind: "premium_directory",
          spotlightId,
          sponsorId: profile.id,
          businessName,
        },
      },
    });
  } catch (err) {
    // No session was created, so nothing will ever expire this pending
    // row: delete it so nothing lingers.
    await basePrisma.premiumDirectorySubscription.delete({ where: { id: sub.id } }).catch(() => {});
    console.error("premium checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  await basePrisma.premiumDirectorySubscription.update({
    where: { id: sub.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
