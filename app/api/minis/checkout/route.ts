import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";
import {
  MINI_PRICE_CENTS,
  MINI_STRIPE_KIND,
  ensureSeedMinis,
  getMiniAccessProfile,
} from "@/lib/minis";

export const dynamic = "force-dynamic";

// Start Stripe Checkout for one guide purchase. Mirrors /api/coupons/checkout.
// Gating is enforced here, not just in the UI: Deals owners and existing
// owners of this guide are never charged.
export async function POST(req: NextRequest) {
  const { email, slug } = await req.json();
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug) {
    return NextResponse.json({ error: "A guide is required." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Payments are not configured right now. Please try again later." }, { status: 503 });
  }

  const workspace = await getWorkspace();
  await ensureSeedMinis(workspace.id, workspace.slug);
  const mini = await basePrisma.mini.findFirst({
    where: { workspaceId: workspace.id, slug, active: true },
    select: { id: true, title: true },
  });
  if (!mini) {
    return NextResponse.json({ error: "That guide is not available." }, { status: 404 });
  }
  const profile = await getMiniAccessProfile(workspace.id, normalizedEmail);
  if (profile.hasDeals) {
    return NextResponse.json(
      { error: "This guide is already included with your Deals book. Check your portal instead." },
      { status: 409 },
    );
  }
  if (profile.ownedMiniSlugs.includes(slug)) {
    return NextResponse.json(
      { error: "You already own this guide. Check your portal instead." },
      { status: 409 },
    );
  }

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
            unit_amount: MINI_PRICE_CENTS,
            product_data: {
              name: `${workspace.name} ${mini.title}`,
              description: "One-time guide purchase",
            },
          },
          quantity: 1,
        },
      ],
      customer_email: normalizedEmail,
      success_url: `${appUrl}/minis/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/minis/${slug}?cancelled=1`,
      metadata: {
        workspaceId: workspace.id,
        kind: MINI_STRIPE_KIND,
        email: normalizedEmail,
        miniId: mini.id,
        miniSlug: slug,
      },
    });
  } catch (err) {
    console.error("mini checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
