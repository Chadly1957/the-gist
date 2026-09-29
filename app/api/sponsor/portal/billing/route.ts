import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { formatWeekRange } from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  presenting: "Presenting Sponsor",
  standard: "Standard Sponsor",
};

// Payment history for the portal. Receipt URLs are fetched from Stripe on
// demand so no extra columns are needed; a failure just yields null.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 400 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });

  const bookings = await prisma.sponsorWeekBooking.findMany({
    where: { sponsorId: profile.id, paidAt: { not: null } },
    include: { week: { select: { weekStart: true } } },
    orderBy: { paidAt: "desc" },
  });

  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

  const payments = [];
  for (const b of bookings) {
    let receiptUrl: string | null = null;
    if (stripe && b.stripeSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(b.stripeSessionId, {
          expand: ["payment_intent"],
        });
        const pi = session.payment_intent as unknown as {
          charges?: { data?: { receipt_url?: string | null }[] };
        } | null;
        receiptUrl = pi?.charges?.data?.[0]?.receipt_url ?? null;
      } catch (err) {
        console.error(`Billing receipt lookup failed for booking ${b.id}:`, err);
      }
    }
    payments.push({
      id: b.id,
      paidAt: b.paidAt ? b.paidAt.toISOString() : null,
      weekLabel: formatWeekRange(b.week.weekStart),
      tierLabel: TIER_LABELS[b.tier] ?? b.tier,
      amountCents: b.amountCents,
      receiptUrl,
    });
  }

  return NextResponse.json({ payments });
}
