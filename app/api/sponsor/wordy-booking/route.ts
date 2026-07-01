import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { token, date, headline, body, ctaUrl, ctaLabel, imageUrl } = await req.json();

  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  if (!date || !headline || !ctaUrl) {
    return NextResponse.json({ error: "Date, headline, and CTA URL are required." }, { status: 400 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    const existing = await db.wordyBooking.findUnique({ where: { date } });
    if (existing && ["pending_review", "approved"].includes(existing.status)) {
      return NextResponse.json({ error: "This date is already booked for a Wordy sponsorship." }, { status: 409 });
    }

    const booking = await db.wordyBooking.create({
      data: {
        sponsorId: profile.id,
        date,
        headline: headline.trim(),
        body: body?.trim() || "",
        ctaUrl: ctaUrl.trim(),
        ctaLabel: ctaLabel?.trim() || "Learn More",
        imageUrl: imageUrl?.trim() || null,
      },
    });

    return NextResponse.json({ booking });
  } catch {
    return NextResponse.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
