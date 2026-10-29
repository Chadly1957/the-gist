import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  COUPON_BOOK_GIFT_STRIPE_KIND,
  couponBookPriceCents,
} from "@/lib/coupon-book";

export const dynamic = "force-dynamic";

// Start Stripe Checkout for a GIFTED coupon book. The buyer pays once
// (their email goes on the Stripe receipt) for the recipient's first year;
// the recipient's email lands in metadata.email so the webhook creates the
// purchase row for the recipient and sends them the gift email. After the
// prepaid year, the recipient renews or lapses like any annual owner.
export async function POST(req: NextRequest) {
  const { recipientEmail, buyerEmail, gifterName, giftMessage } = await req.json();
  const normalizedRecipient = recipientEmail?.trim().toLowerCase();
  const normalizedBuyer = buyerEmail?.trim().toLowerCase();
  if (!normalizedRecipient || !normalizedRecipient.includes("@")) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }
  if (!normalizedBuyer || !normalizedBuyer.includes("@")) {
    return NextResponse.json({ error: "A valid email for your receipt is required." }, { status: 400 });
  }
  // Trim gift fields; Stripe metadata values must be short strings.
  const name = (gifterName || "").trim().slice(0, 80);
  const message = (giftMessage || "").trim().slice(0, 280);
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
              name: `${workspace.name} Deals Book (Gift)`,
              description: `One year of the Deals Book, prepaid as a gift`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: normalizedBuyer,
      success_url: `${appUrl}/deals/gift-success?to=${encodeURIComponent(normalizedRecipient)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/deals/gift?cancelled=1`,
      metadata: {
        workspaceId: workspace.id,
        kind: COUPON_BOOK_GIFT_STRIPE_KIND,
        email: normalizedRecipient,
        gifterEmail: normalizedBuyer,
        ...(name ? { gifterName: name } : {}),
        ...(message ? { giftMessage: message } : {}),
      },
    });
  } catch (err) {
    console.error("coupon gift checkout stripe error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
