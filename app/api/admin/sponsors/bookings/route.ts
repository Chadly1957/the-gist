import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId, type, date, headline, body, ctaUrl, ctaLabel, imageUrl, presentingBlurb, status } = await req.json();

  if (!profileId || !type || !date || !headline || !body || !ctaUrl || !ctaLabel) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const profile = await prisma.sponsorProfile.findUnique({ where: { id: profileId } });
  if (!profile) return NextResponse.json({ error: "Sponsor not found." }, { status: 404 });

  const booking = await prisma.adBooking.create({
    data: {
      sponsorId: profile.id,
      type,
      date,
      headline,
      body,
      ctaUrl,
      ctaLabel,
      imageUrl: imageUrl || null,
      presentingBlurb: presentingBlurb || null,
      status: status || "approved",
      isPaid: false,
      approvedAt: status === "approved" || !status ? new Date() : null,
    },
  });

  return NextResponse.json({ booking });
}
