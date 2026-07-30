import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const MIN_CENTS = 100; // $1
const MAX_CENTS = 50000; // $500
const VALID_SOURCES = ["web", "newsletter", "wordy", "match"];

export async function POST(req: NextRequest) {
  const { amountCents, source } = await req.json();

  if (!Number.isInteger(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return NextResponse.json({ error: "Enter an amount between $1 and $500." }, { status: 400 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const tipSource = VALID_SOURCES.includes(source) ? source : "web";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: "Tip — The Gist Decatur" },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${appUrl}/tip?success=1`,
    cancel_url: `${appUrl}/tip?cancelled=1`,
  });

  await prisma.tip.create({
    data: {
      amountCents,
      source: tipSource,
      status: "pending_payment",
      stripeSessionId: session.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
