import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";
import {
  MINI_UPGRADE_STRIPE_KIND,
  UPGRADE_PRICE_CENTS,
  getMiniAccessProfile,
} from "@/lib/minis";

export const dynamic = "force-dynamic";

// Start Stripe Checkout for the flat $10 upgrade to the full Deals book
// (Option B: flat $5 off, no stacking). Eligibility is enforced here, not
// just in the UI: only Mini owners without Deals may upgrade.
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
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: UPGRADE_PRICE_CENTS,
            product_data: {
              name: `${workspace.name} Gist Deals Book`,
              description: "One-time upgrade to the full book",
            },
          },
          quantity: 1,
        },
      ],
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
    });
  } catch (err) {
    console.error("mini upgrade checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
