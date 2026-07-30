import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

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

  if (event.type === "checkout.session.completed") {
    const approvedAt = new Date();
    await prisma.adBooking.updateMany({
      where: { stripeSessionId: sessionId, status: "pending_payment" },
      data: { isPaid: true, status: "approved", approvedAt },
    });
    await prisma.tip.updateMany({
      where: { stripeSessionId: sessionId, status: "pending_payment" },
      data: { status: "paid", paidAt: approvedAt },
    });
  }

  if (event.type === "checkout.session.expired") {
    await prisma.adBooking.deleteMany({
      where: { stripeSessionId: sessionId, status: "pending_payment" },
    });
    await prisma.tip.deleteMany({
      where: { stripeSessionId: sessionId, status: "pending_payment" },
    });
  }

  return NextResponse.json({ received: true });
}
