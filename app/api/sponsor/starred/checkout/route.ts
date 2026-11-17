import { getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";
import {
  STARRED_LIVE_STATUSES,
  STARRED_MAX_SPOTS,
  STARRED_PRICE_CENTS,
} from "@/lib/starred-board";

export const dynamic = "force-dynamic";

// POST /api/sponsor/starred/checkout { token, spotlightId }
// Creates a pending StarredBoardSubscription under a locked cap check,
// then a Stripe Checkout session for the $39.99/mo subscription. The
// webhook flips the row to active on checkout.session.completed; the
// listing shows at the top of the Community Partners block from the
// next issue. The listing must be approved or active: the free signup
// creates it as active (instant acceptance), portal-created listings
// are pending until an admin approves them.
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
      { error: "This listing is still waiting for approval before it can be starred." },
      { status: 409 }
    );
  }

  const workspaceId = profile.workspaceId;
  const businessName = profile.businessName;

  // Cap check + pending-row creation inside one transaction holding a row
  // lock on the workspace (mirrors withWeekLock in lib/sponsor-weeks.ts):
  // two near-simultaneous checkouts cannot both pass the 5-spot cap.
  // The partial unique index in the migration is the backstop for one
  // listing holding two live subscriptions.
  let sub;
  try {
    sub = await basePrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
      const taken = await tx.starredBoardSubscription.count({
        where: { workspaceId, status: { in: [...STARRED_LIVE_STATUSES] } },
      });
      if (taken >= STARRED_MAX_SPOTS) {
        throw new Error("Starred spots are sold out.");
      }
      const existing = await tx.starredBoardSubscription.findFirst({
        where: { workspaceId, spotlightId, status: { in: [...STARRED_LIVE_STATUSES] } },
      });
      if (existing) {
        throw new Error("This listing already has a Starred subscription.");
      }
      return tx.starredBoardSubscription.create({
        data: {
          workspaceId,
          spotlightId,
          sponsorId: profile.id,
          status: "pending_payment",
          monthlyAmountCents: STARRED_PRICE_CENTS,
        },
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start checkout.";
    if (msg === "Starred spots are sold out." || msg === "This listing already has a Starred subscription.") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("starred checkout cap check failed:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  // Reuse the Stripe customer when this sponsor has starred before (the
  // id lives on the subscription row; SponsorProfile carries none), so a
  // repeat buyer keeps one Stripe customer. Otherwise Checkout creates
  // the customer from the profile email.
  const prior = await basePrisma.starredBoardSubscription.findFirst({
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
            unit_amount: STARRED_PRICE_CENTS,
            recurring: { interval: "month" },
            product_data: { name: `Starred Community Board — ${businessName}` },
          },
          quantity: 1,
        },
      ],
      ...(prior?.stripeCustomerId
        ? { customer: prior.stripeCustomerId }
        : { customer_email: profile.email }),
      success_url: `${appUrl}/sponsor/success?starred=1`,
      cancel_url: `${appUrl}/sponsor/portal?token=${profile.magicToken}`,
      metadata: {
        workspaceId,
        kind: "starred_board",
        spotlightId,
        sponsorId: profile.id,
        businessName,
      },
      // The subscription carries the same routing metadata so lifecycle
      // events stay attributable even without the session.
      subscription_data: {
        metadata: {
          workspaceId,
          kind: "starred_board",
          spotlightId,
          sponsorId: profile.id,
          businessName,
        },
      },
    });
  } catch (err) {
    // No session was created, so nothing will ever expire this pending
    // row: delete it so the cap slot frees up immediately.
    await basePrisma.starredBoardSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    console.error("starred checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  await basePrisma.starredBoardSubscription.update({
    where: { id: sub.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ url: session.url });
}
