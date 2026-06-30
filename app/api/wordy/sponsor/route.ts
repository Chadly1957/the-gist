import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || new Date().toLocaleDateString("en-CA");

  const booking = await prisma.wordyBooking.findUnique({
    where: { date },
    include: { sponsor: { select: { businessName: true } } },
  });

  if (!booking || booking.status !== "approved") {
    return NextResponse.json({ sponsor: null });
  }

  return NextResponse.json({
    sponsor: {
      businessName: booking.sponsor.businessName,
      headline: booking.headline,
      body: booking.body,
      ctaUrl: booking.ctaUrl,
      ctaLabel: booking.ctaLabel,
      imageUrl: booking.imageUrl,
      presentingBlurb: booking.presentingBlurb,
    },
  });
}
