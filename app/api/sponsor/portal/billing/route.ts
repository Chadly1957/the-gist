import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { formatWeekRange, WEEK_TIERS, isValidTier } from "@/lib/sponsor-weeks";
import { STARRED_PRICE_CENTS, STARRED_SHOWING_STATUSES } from "@/lib/starred-board";

export const dynamic = "force-dynamic";

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
      tierLabel: isValidTier(b.tier) ? WEEK_TIERS[b.tier].label : b.tier,
      amountCents: b.amountCents,
      receiptUrl,
    });
  }

  // Starred Community Board subscriptions: one row per live subscription
  // ($39.99/mo) with the next billing date and the latest paid invoice's
  // receipt URL, fetched on demand like the week-booking receipts above.
  // A failure just yields null for that row's receipt.
  const starredSubs = await prisma.starredBoardSubscription.findMany({
    where: { sponsorId: profile.id, status: { in: [...STARRED_SHOWING_STATUSES] } },
    include: { spotlight: { select: { businessName: true } } },
    orderBy: { startedAt: "desc" },
  });
  for (const s of starredSubs) {
    let receiptUrl: string | null = null;
    let lastPaidAt: Date = s.startedAt ?? s.createdAt;
    if (stripe && s.stripeSubscriptionId) {
      try {
        const invoices = await stripe.invoices.list({
          subscription: s.stripeSubscriptionId,
          status: "paid",
          limit: 1,
          expand: ["data.payments.data.payment.payment_intent", "data.payments.data.payment.charge"],
        });
        const inv = invoices.data[0];
        if (inv) {
          // Receipt URL lives on the payment: a standalone charge carries
          // receipt_url directly; a PaymentIntent carries it on its first
          // charge (same pattern as the week-booking receipts above).
          const payment = inv.payments?.data?.[0]?.payment;
          if (payment) {
            if (payment.type === "charge" && payment.charge && typeof payment.charge !== "string") {
              receiptUrl = payment.charge.receipt_url ?? null;
            } else if (payment.type === "payment_intent" && payment.payment_intent && typeof payment.payment_intent !== "string") {
              const pi = payment.payment_intent as unknown as {
                charges?: { data?: { receipt_url?: string | null }[] };
              };
              receiptUrl = pi.charges?.data?.[0]?.receipt_url ?? null;
            }
          }
          const paidAt = inv.status_transitions?.paid_at ?? inv.created;
          if (typeof paidAt === "number" && paidAt > 0) lastPaidAt = new Date(paidAt * 1000);
        }
      } catch (err) {
        console.error(`Billing receipt lookup failed for starred subscription ${s.id}:`, err);
      }
    }
    const renews = s.currentPeriodEnd
      ? s.currentPeriodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;
    payments.push({
      id: `starred-${s.id}`,
      paidAt: lastPaidAt.toISOString(),
      weekLabel: "Starred Community Board",
      tierLabel: renews ? `Monthly · renews ${renews}` : "Monthly subscription",
      amountCents: STARRED_PRICE_CENTS,
      receiptUrl,
    });
  }

  // Newest payment first across both kinds.
  payments.sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));

  return NextResponse.json({ payments });
}
