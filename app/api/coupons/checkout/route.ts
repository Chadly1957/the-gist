import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  COUPON_BOOK_STRIPE_KIND,
  couponBookPriceCents,
} from "@/lib/coupon-book";

export const dynamic = "force-dynamic";

// Start Stripe Checkout for a coupon book purchase. The webhook fulfills it
// (creates the purchase row + emails the magic link) on checkout.session.completed.
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
  const amountCents = couponBookPriceCents();

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
            unit_amount: amountCents,
            product_data: {
              name: `${workspace.name} Coupon Book`,
              description: `One-time purchase — yours for life`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: normalizedEmail,
      success_url: `${appUrl}/deals/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/deals?cancelled=1`,
      metadata: { workspaceId: workspace.id, kind: COUPON_BOOK_STRIPE_KIND, email: normalizedEmail },
    });
  } catch (err) {
    console.error("coupon checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
