import { basePrisma } from "@/lib/db-base";
import { formatWeekRange } from "@/lib/sponsor-weeks";
import { sendFulfillmentAlert } from "@/lib/sponsor-week-email";

export type BookingForAlert = {
  id: string;
  businessName: string;
  tier: string;
  weekStart: string;
  amountCents: number;
  contactName: string;
  email: string;
  fulfillmentAlertSentAt: Date | null;
};

/**
 * Raise the loud failure alarm for a booking, at most once per booking.
 * Every booking must end in a verifiable complete state or a visible alarm;
 * this is the alarm. Best-effort: never throws, so alerting can never break
 * the caller (webhook or cron).
 */
export async function alertBookingFailureOnce(
  workspaceId: string,
  booking: BookingForAlert,
  failureSummary: string,
  adminUrl: string,
): Promise<boolean> {
  try {
    const fresh = await basePrisma.sponsorWeekBooking.findFirst({
      where: { workspaceId, id: booking.id },
      select: { fulfillmentAlertSentAt: true },
    });
    // findFirst returns null when the booking row itself is gone; alert anyway.
    if (fresh?.fulfillmentAlertSentAt) return false;
    const sent = await sendFulfillmentAlert({
      businessName: booking.businessName,
      tierLabel: booking.tier === "presenting" ? "Presenting Sponsor" : "Standard Sponsor",
      weekLabel: booking.weekStart ? formatWeekRange(booking.weekStart) : "unknown week",
      amountCents: booking.amountCents,
      contactName: booking.contactName,
      buyerEmail: booking.email,
      failureSummary,
      adminUrl,
    });
    if (sent && fresh) {
      await basePrisma.sponsorWeekBooking.updateMany({
        where: { workspaceId, id: booking.id, fulfillmentAlertSentAt: null },
        data: { fulfillmentAlertSentAt: new Date() },
      });
    }
    return sent;
  } catch (err) {
    console.error(`ALERT FAILED for booking ${booking.id}:`, err, failureSummary);
    return false;
  }
}

export function toAlertShape(b: {
  id: string;
  businessName: string;
  tier: string;
  amountCents: number;
  contactName: string;
  email: string;
  fulfillmentAlertSentAt: Date | null;
  week: { weekStart: string };
}): BookingForAlert {
  return {
    id: b.id,
    businessName: b.businessName,
    tier: b.tier,
    weekStart: b.week.weekStart,
    amountCents: b.amountCents,
    contactName: b.contactName,
    email: b.email,
    fulfillmentAlertSentAt: b.fulfillmentAlertSentAt,
  };
}
