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

  // Clicks attributed to this sponsor's business name
  const clicks = await prisma.linkClick.findMany({
    where: {
      label: profile.businessName,
      linkType: { in: ["spotlight", "in_article_ad", "presenting_sponsor"] },
    },
    select: { linkType: true, createdAt: true },
  });

  const spotlightClicks = clicks.filter((c) => c.linkType === "spotlight").length;
  const adClicks = clicks.filter((c) => c.linkType !== "spotlight").length;

  // Per-booking click counts
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

  // ── Impressions ──────────────────────────────────────────────────────────
  // Spotlight: unique opens across all sends where this spotlight appeared
  const spotlightIds = profile.spotlights.map((s) => s.id);
  let spotlightImpressions = 0;

  if (spotlightIds.length > 0) {
    const appearances = await prisma.newsletterSendSpotlight.findMany({
      where: { spotlightId: { in: spotlightIds } },
      select: { newsletterSendId: true },
    });
    const sendIds = Array.from(new Set(appearances.map((a) => a.newsletterSendId)));
    if (sendIds.length > 0) {
      spotlightImpressions = await prisma.newsletterRecipient.count({
        where: { newsletterSendId: { in: sendIds }, openCount: { gt: 0 } },
      });
    }
  }

  // Booking: unique opens of the newsletter on each booking's date
  const bookingImpressions: Record<string, number> = {};
  const bookingDates = Array.from(new Set(profile.bookings.map((b) => b.date)));

  for (const date of bookingDates) {
    const send = await prisma.newsletterSend.findFirst({
      where: {
        sentAt: { gte: new Date(date + "T00:00:00Z"), lte: new Date(date + "T23:59:59Z") },
        status: "sent",
      },
      select: { id: true },
    });
    if (send) {
      const opens = await prisma.newsletterRecipient.count({
        where: { newsletterSendId: send.id, openCount: { gt: 0 } },
      });
      for (const booking of profile.bookings.filter((b) => b.date === date)) {
        bookingImpressions[booking.id] = opens;
      }
    }
  }

  const adImpressions = Object.values(bookingImpressions).reduce((s, n) => s + n, 0);

  return NextResponse.json({
    profile,
    analytics: {
      spotlightClicks,
      spotlightImpressions,
      adClicks,
      adImpressions,
      bookingClicks,
      bookingImpressions,
    },
  });
}
