import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";
import { fulfillPaidWeekBooking } from "@/lib/sponsor-week-fulfillment";

export const dynamic = "force-dynamic";

/**
 * Record an offline payment for a week booking stuck in pending_payment
 * (the BIG H case: money arrived outside Stripe, so no webhook ever fired).
 * Transitions to paid, projects the 5 day rows, and sends the standard
 * buyer confirmation + owner notification, exactly like the webhook path.
 * Idempotent: already-paid bookings are returned unchanged.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = DEFAULT_WORKSPACE_ID;
  const booking = await basePrisma.sponsorWeekBooking.findFirst({
    where: { id: params.id, workspaceId },
    include: { week: { select: { weekStart: true } }, sponsor: { select: { magicToken: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "pending_payment") {
    return NextResponse.json({ booking, alreadyDone: true });
  }

  await fulfillPaidWeekBooking(workspaceId, booking);
  const updated = await basePrisma.sponsorWeekBooking.findFirst({
    where: { id: params.id, workspaceId },
    select: { id: true, status: true, paidAt: true },
  });
  return NextResponse.json({ booking: updated });
}
