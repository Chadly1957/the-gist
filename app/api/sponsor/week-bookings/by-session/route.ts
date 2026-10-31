import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { formatWeekRange, WEEK_TIERS, isValidTier } from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Lets the post-payment success page confirm the booking landed.
export async function GET(req: NextRequest) {
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "session_id required." }, { status: 400 });
  const workspace = await getWorkspace();
  const booking = await basePrisma.sponsorWeekBooking.findFirst({
    where: { workspaceId: workspace.id, stripeSessionId: sessionId },
    include: { week: { select: { weekStart: true } } },
  });
  if (!booking) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    paid: booking.status === "paid" || booking.status === "completed",
    businessName: booking.businessName,
    tierLabel: isValidTier(booking.tier) ? WEEK_TIERS[booking.tier].label : booking.tier,
    weekLabel: formatWeekRange(booking.week.weekStart),
  });
}
