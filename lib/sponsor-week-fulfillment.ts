import { basePrisma } from "./db-base";
import { withWorkspace } from "./workspace";
import { buildWeekProjectionRows, type WeekTier } from "./sponsor-weeks";
import { sendOwnerBookingNotification, sendWeekBookingConfirmation } from "./sponsor-week-email";
import { alertBookingFailureOnce, type BookingForAlert } from "./sponsor-booking-alerts";

/**
 * Shared payment fulfillment for week bookings, used by both the Stripe
 * webhook and the admin "mark as paid" action (offline payments).
 *
 * Atomically transitions the booking pending_payment -> paid and projects
 * the 5 day-based AdBooking rows, then sends the buyer confirmation and the
 * owner notification. Idempotent: concurrent calls for the same booking
 * resolve to a single fulfillment via the status predicate in updateMany.
 */
export interface FulfillableWeekBooking {
  id: string;
  workspaceId: string;
  sponsorId: string;
  tier: string;
  status: string;
  amountCents: number;
  businessName: string;
  contactName: string;
  email: string;
  website: string | null;
  logoUrl: string;
  aboutText: string;
  chadWritesCopy: boolean;
  finalAdCopy: string | null;
  fulfillmentAlertSentAt: Date | null;
  week: { weekStart: string };
  sponsor: { magicToken: string };
}

export async function fulfillPaidWeekBooking(workspaceId: string, booking: FulfillableWeekBooking): Promise<void> {
  const { getWorkspaceUrl } = await import("@/lib/workspace");
  const workspace = await basePrisma.workspace.findUnique({ where: { id: workspaceId } });
  const appUrl = workspace ? await withWorkspace(workspace, () => getWorkspaceUrl()) : "";

  // Idempotent: a redelivered webhook or a double-clicked admin button must
  // not fulfill twice.
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
  const rows = buildWeekProjectionRows({
    ...booking,
    tier: booking.tier as WeekTier,
    weekStart: booking.week.weekStart,
  });
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
    // Payment captured but the slot lock / ad placement failed. The Stripe
    // webhook path retries automatically; alert Chad now so a prolonged
    // outage can never slip by silently again.
    console.error(`Sponsor week fulfillment transaction failed for booking ${booking.id}:`, err);
    await alertBookingFailureOnce(
      workspaceId,
      alertShape,
      `Payment was captured but locking the slot and placing the ad failed (${err instanceof Error ? err.message : "database error"}). If this came from Stripe it will retry automatically; if no "Booked" email follows within the hour, intervene in admin.`,
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
