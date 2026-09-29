import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";
import { withWorkspace } from "@/lib/workspace";
import Stripe from "stripe";
import { buildWeekProjectionRows, type WeekTier } from "@/lib/sponsor-weeks";
import { sendOwnerCopyTask, sendWeekBookingConfirmation } from "@/lib/sponsor-week-email";

export const dynamic = "force-dynamic";

async function fulfillWeekBooking(workspaceId: string, session: Stripe.Checkout.Session) {
  const booking = await basePrisma.sponsorWeekBooking.findFirst({
    where: { workspaceId, stripeSessionId: session.id },
    include: { week: { select: { weekStart: true } }, sponsor: { select: { magicToken: true } } },
  });
  // Idempotent: Stripe may redeliver this event.
  if (!booking || booking.status !== "pending_payment") return;

  // Atomically transition to paid AND project the 5 day rows. The status
  // predicate in updateMany means only one concurrent delivery wins; the
  // loser sees count 0 and stops before sending duplicate emails. Doing both
  // in one transaction means a crash can never leave a paid booking with no
  // projected rows (which the old status-first code allowed, permanently
  // skipping fulfillment on retry).
  const rows = buildWeekProjectionRows({ ...booking, tier: booking.tier as WeekTier, weekStart: booking.week.weekStart });
  const didFulfill = await basePrisma.$transaction(async (tx) => {
    const updated = await tx.sponsorWeekBooking.updateMany({
      where: { workspaceId, id: booking.id, status: "pending_payment" },
      data: { status: "paid", paidAt: new Date() },
    });
    if (updated.count === 0) return false;
    await tx.adBooking.createMany({ data: rows });
    return true;
  });
  if (!didFulfill) return;

  const workspace = await basePrisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return;
  await withWorkspace(workspace, async () => {
    const { getWorkspaceUrl } = await import("@/lib/workspace");
    const appUrl = await getWorkspaceUrl();
    const portalUrl = `${appUrl}/sponsor/portal?token=${booking.sponsor.magicToken}`;
    const tierLabel = booking.tier === "presenting" ? "Presenting Sponsor" : "Standard Sponsor";
    const { formatWeekRange } = await import("@/lib/sponsor-weeks");
    const weekLabel = formatWeekRange(booking.week.weekStart);
    await sendWeekBookingConfirmation({
      to: booking.email,
      contactName: booking.contactName,
      businessName: booking.businessName,
      tierLabel,
      weekLabel,
      portalUrl,
      chadWritesCopy: booking.chadWritesCopy,
    });
    await sendOwnerCopyTask({
      businessName: booking.businessName,
      tierLabel,
      weekLabel,
      aboutText: booking.aboutText,
      logoUrl: booking.logoUrl,
      chadWritesCopy: booking.chadWritesCopy,
      adminUrl: `${appUrl}/admin/sponsors`,
    });
  });
}

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
  const workspaceId = session.metadata?.workspaceId || DEFAULT_WORKSPACE_ID;

  if (event.type === "checkout.session.completed") {
    const approvedAt = new Date();
    if (session.metadata?.kind === "sponsor_week") {
      await fulfillWeekBooking(workspaceId, session);
    } else {
      await basePrisma.adBooking.updateMany({
        where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
        data: { isPaid: true, status: "approved", approvedAt },
      });
    }
    await basePrisma.tip.updateMany({
      where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
      data: { status: "paid", paidAt: approvedAt },
    });
  }

  if (event.type === "checkout.session.expired") {
    await basePrisma.sponsorWeekBooking.deleteMany({
      where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
    });
    await basePrisma.adBooking.deleteMany({
      where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
    });
    await basePrisma.tip.deleteMany({
      where: { workspaceId, stripeSessionId: sessionId, status: "pending_payment" },
    });
  }

  return NextResponse.json({ received: true });
}
