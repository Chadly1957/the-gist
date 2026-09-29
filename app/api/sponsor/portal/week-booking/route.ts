import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/url";
import { isCreativeLocked, shapePortalWeekBooking } from "@/lib/sponsor-week-stats";

export const dynamic = "force-dynamic";

// Let a sponsor edit their ad creative/logo for an upcoming week.
// Locked 24h before the week starts; finalized copy (written by Chad) is
// never overwritten by the sponsor's edits.
export async function PATCH(req: NextRequest) {
  const { token, bookingId, logoUrl, aboutText, website } = await req.json();
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });
  if (!bookingId) return NextResponse.json({ error: "Booking required." }, { status: 400 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 404 });

  const booking = await prisma.sponsorWeekBooking.findFirst({
    where: { id: bookingId, sponsorId: profile.id },
    include: { week: { select: { weekStart: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "paid") {
    return NextResponse.json({ error: "Only upcoming paid weeks can be edited." }, { status: 400 });
  }
  if (isCreativeLocked(booking.week.weekStart)) {
    return NextResponse.json({ error: "Creative is locked for this week." }, { status: 400 });
  }

  const data: { logoUrl?: string; aboutText?: string; website?: string | null } = {};
  if (logoUrl !== undefined) {
    if (typeof logoUrl !== "string" || !logoUrl.startsWith("https://")) {
      return NextResponse.json({ error: "Logo must be an uploaded image." }, { status: 400 });
    }
    data.logoUrl = logoUrl;
  }
  if (aboutText !== undefined) {
    const trimmed = typeof aboutText === "string" ? aboutText.trim() : "";
    if (trimmed.length < 20) {
      return NextResponse.json({ error: "Tell readers a little about your business (a sentence or two)." }, { status: 400 });
    }
    data.aboutText = trimmed;
  }
  if (website !== undefined) {
    if (typeof website === "string" && website.trim() === "") {
      data.website = null;
    } else {
      try {
        data.website = normalizeUrl(website);
      } catch {
        return NextResponse.json({ error: "That website URL doesn't look right." }, { status: 400 });
      }
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // Push the creative onto the projected Mon-Fri rows too. When Chad already
  // finalized the copy, his version wins and the sponsor's about text is
  // stored on the booking only.
  const clobberBody = !booking.chadWritesCopy || !booking.finalAdCopy;
  const dayData: { imageUrl?: string; body?: string; ctaUrl?: string } = {};
  if (data.logoUrl !== undefined) dayData.imageUrl = data.logoUrl;
  if (data.aboutText !== undefined && clobberBody) dayData.body = data.aboutText;
  if (data.website !== undefined) dayData.ctaUrl = data.website ?? "";

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.sponsorWeekBooking.update({ where: { id: booking.id }, data });
    if (Object.keys(dayData).length > 0) {
      await tx.adBooking.updateMany({ where: { sponsorWeekBookingId: booking.id }, data: dayData });
    }
    return next;
  });

  return NextResponse.json({
    ok: true,
    booking: shapePortalWeekBooking({
      id: updated.id,
      tier: updated.tier,
      weekStart: booking.week.weekStart,
      status: updated.status,
      amountCents: updated.amountCents,
      paidAt: updated.paidAt,
      businessName: updated.businessName,
      logoUrl: updated.logoUrl,
      website: updated.website,
      aboutText: updated.aboutText,
      chadWritesCopy: updated.chadWritesCopy,
      finalAdCopy: updated.finalAdCopy,
    }),
  });
}
