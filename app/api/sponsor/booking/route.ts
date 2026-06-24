import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { token, type, date, headline, body, ctaUrl, ctaLabel, imageUrl, presentingBlurb } = await req.json();

  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  if (!type || !date || !headline || !body || !ctaUrl) {
    return NextResponse.json({ error: "Type, date, headline, body, and CTA URL are required." }, { status: 400 });
  }

  if (!["in_article", "presenting"].includes(type)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  if (body.length > 250) {
    return NextResponse.json({ error: "Body must be 250 characters or less." }, { status: 400 });
  }

  // Check availability
  const existing = await prisma.adBooking.findMany({
    where: { date, status: { in: ["pending_review", "approved"] } },
  });

  const inArticleCount = existing.filter((b) => b.type === "in_article").length;
  const presentingCount = existing.filter((b) => b.type === "presenting").length;

  if (type === "in_article" && inArticleCount >= 2) {
    return NextResponse.json({ error: "This date is fully booked for standard ad sponsorships." }, { status: 409 });
  }
  if (type === "presenting" && presentingCount >= 1) {
    return NextResponse.json({ error: "This date already has a presenting sponsor." }, { status: 409 });
  }

  const booking = await prisma.adBooking.create({
    data: {
      sponsorId: profile.id,
      type,
      date,
      headline: headline.trim(),
      body: body.trim(),
      ctaUrl: ctaUrl.trim(),
      ctaLabel: ctaLabel?.trim() || "Learn More",
      imageUrl: imageUrl?.trim() || null,
      presentingBlurb: presentingBlurb?.trim() || null,
    },
  });

  return NextResponse.json({ booking });
}
