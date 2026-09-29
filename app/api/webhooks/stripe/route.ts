import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";
import { withWorkspace } from "@/lib/workspace";
import Stripe from "stripe";
import { buildWeekProjectionRows, type WeekTier } from "@/lib/sponsor-weeks";
import { sendOwnerBookingNotification, sendWeekBookingConfirmation } from "@/lib/sponsor-week-email";
import { alertBookingFailureOnce, type BookingForAlert } from "@/lib/sponsor-booking-alerts";

export const dynamic = "force-dynamic";

async function fulfillWeekBooking(workspaceId: string, session: Stripe.Checkout.Session) {
  const booking = await basePrisma.sponsorWeekBooking.findFirst({
    where: { workspaceId, stripeSessionId: session.id },
    include: { week: { select: { weekStart: true } }, sponsor: { select: { magicToken: true } } },
  });

  const { getWorkspaceUrl } = await import("@/lib/workspace");
  const workspace = await basePrisma.workspace.findUnique({ where: { id: workspaceId } });
  const appUrl = workspace ? await withWorkspace(workspace, () => getWorkspaceUrl()) : "";

  if (!booking) {
    // The booking row is missing but Stripe says payment completed. This can
    // happen if checkout.session.expired was processed out of order and
    // deleted the pending row. Money is captured with no booking: alert loudly.
    if (session.payment_status === "paid") {
      console.error(`Sponsor week payment captured but no booking row for session ${session.id}`);
      await alertBookingFailureOnce(
        workspaceId,
        {
          id: session.id,
          businessName: session.customer_details?.name || "Unknown business",
          tier: session.metadata?.tier || "standard",
          weekStart: session.metadata?.weekStart || "",
          amountCents: session.amount_total ?? 0,
          contactName: session.customer_details?.name || "",
          email: session.customer_details?.email || "",
          fulfillmentAlertSentAt: null,
        },
        `Stripe reports payment captured for checkout session ${session.id}, but no matching sponsor week booking exists. The slot was never locked and no ad was placed.`,
        `${appUrl}/admin/sponsors?tab=weekly`,
      );
    }
    return;
  }
  // Idempotent: Stripe may redeliver this event.
  if (booking.status !== "pending_payment") return;

  const adminBookingUrl = `${appUrl}/admin/sponsors?tab=weekly&highlight=${booking.id}`;
  const alertShape: BookingForAlert = {
    id: booking.id,
    businessName: booking.businessName,
    tier: booking.tier,
    weekStart: booking.week.weekStart,
    amountCents: booking.amountCents,
    contactName: booking.contactName,
    email: booking.email,
    fulfillmentAlertSentAt: booking.fulfillmentAlertSentAt,
  };

  // Atomically transition to paid AND project the 5 day rows. The status
  // predicate in updateMany means only one concurrent delivery wins; the
  // loser sees count 0 and stops before sending duplicate emails.
  const rows = buildWeekProjectionRows({ ...booking, tier: booking.tier as WeekTier, weekStart: booking.week.weekStart });
  let didFulfill = false;
  try {
    didFulfill = await basePrisma.$transaction(async (tx) => {
      const updated = await tx.sponsorWeekBooking.updateMany({
        where: { workspaceId, id: booking.id, status: "pending_payment" },
        data: { status: "paid", paidAt: new Date() },
      });
      if (updated.count === 0) return false;
      await tx.adBooking.createMany({ data: rows });
      return true;
    });
  } catch (err) {
    // Payment captured but the slot lock / ad placement failed. Stripe will
    // retry this event automatically; alert Chad now so a prolonged outage
    // can never slip by silently again.
    console.error(`Sponsor week fulfillment transaction failed for booking ${booking.id}:`, err);
    await alertBookingFailureOnce(
      workspaceId,
      alertShape,
      `Payment was captured but locking the slot and placing the ad failed (${err instanceof Error ? err.message : "database error"}). Stripe will retry automatically; if no "Booked" email follows within the hour, intervene in admin.`,
      adminBookingUrl,
    );
    throw err;
  }
  if (!didFulfill) return;

  // Downstream notifications. The booking is complete in the database; if any
  // of these fail, the failure is silent without an alarm, so verify each one.
  if (!workspace) {
    await alertBookingFailureOnce(
      workspaceId, alertShape,
      "Payment captured and the slot was locked, but the workspace record is missing so confirmation emails could not be sent.",
      adminBookingUrl,
    );
    return;
  }
  await withWorkspace(workspace, async () => {
    const liveAppUrl = await getWorkspaceUrl();
    const liveAdminUrl = `${liveAppUrl}/admin/sponsors?tab=weekly&highlight=${booking.id}`;
    const portalUrl = `${liveAppUrl}/sponsor/portal?token=${booking.sponsor.magicToken}`;
    const tierLabel = booking.tier === "presenting" ? "Presenting Sponsor" : "Standard Sponsor";
    const { formatWeekRange } = await import("@/lib/sponsor-weeks");
    const weekLabel = formatWeekRange(booking.week.weekStart);

    const failures: string[] = [];

    const buyerOk = await sendWeekBookingConfirmation({
      to: booking.email,
      contactName: booking.contactName,
      businessName: booking.businessName,
      tierLabel,
      weekLabel,
      portalUrl,
      chadWritesCopy: booking.chadWritesCopy,
    });
    if (buyerOk) {
      await basePrisma.sponsorWeekBooking.updateMany({
        where: { workspaceId, id: booking.id, buyerNotifiedAt: null },
        data: { buyerNotifiedAt: new Date() },
      });
    } else {
      failures.push("the buyer confirmation email failed to send");
    }

    const ownerOk = await sendOwnerBookingNotification({
      businessName: booking.businessName,
      tierLabel,
      weekLabel,
      amountCents: booking.amountCents,
      contactName: booking.contactName,
      buyerEmail: booking.email,
      aboutText: booking.aboutText,
      logoUrl: booking.logoUrl,
      chadWritesCopy: booking.chadWritesCopy,
      adminUrl: liveAdminUrl,
    });
    if (ownerOk) {
      await basePrisma.sponsorWeekBooking.updateMany({
        where: { workspaceId, id: booking.id, ownerNotifiedAt: null },
        data: { ownerNotifiedAt: new Date() },
      });
    } else {
      failures.push("the owner notification email failed to send");
    }

    if (failures.length > 0) {
      await alertBookingFailureOnce(
        workspaceId, alertShape,
        `Payment captured, slot locked, and ad placed for ${booking.businessName}, but ${failures.join(" and ")}.`,
        liveAdminUrl,
      );
    }
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
