import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 400 });

  const profile = await prisma.sponsorProfile.findUnique({
    where: { magicToken: token },
    include: {
      spotlights: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { date: "asc" } },
    },
  });

  if (!profile) return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });

  // Pull all clicks attributed to this sponsor's business name
  const clicks = await prisma.linkClick.findMany({
    where: {
      label: profile.businessName,
      linkType: { in: ["spotlight", "in_article_ad", "presenting_sponsor"] },
    },
    select: { linkType: true, createdAt: true },
  });

  const spotlightClicks = clicks.filter((c) => c.linkType === "spotlight").length;
  const adClicks = clicks.filter((c) => c.linkType !== "spotlight").length;

  // Per-booking click counts — match by date string (YYYY-MM-DD) and ad type
  const BOOKING_LINK_TYPE: Record<string, string> = {
    in_article: "in_article_ad",
    presenting: "presenting_sponsor",
  };
  const bookingClicks: Record<string, number> = {};
  for (const booking of profile.bookings) {
    const linkType = BOOKING_LINK_TYPE[booking.type];
    bookingClicks[booking.id] = clicks.filter(
      (c) => c.linkType === linkType && c.createdAt.toISOString().slice(0, 10) === booking.date
    ).length;
  }

  return NextResponse.json({
    profile,
    analytics: { spotlightClicks, adClicks, bookingClicks },
  });
}
