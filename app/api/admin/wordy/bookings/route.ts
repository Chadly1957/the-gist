import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookings = await prisma.wordyBooking.findMany({
    orderBy: { date: "asc" },
    include: { sponsor: { select: { businessName: true, contactName: true, email: true } } },
  });

  return NextResponse.json({ bookings });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, sponsorId, headline, body, ctaUrl, ctaLabel, imageUrl, presentingBlurb } = await req.json();
  if (!date || !sponsorId || !headline) {
    return NextResponse.json({ error: "Date, sponsor, and headline are required." }, { status: 400 });
  }

  const booking = await prisma.wordyBooking.upsert({
    where: { date },
    create: { date, sponsorId, headline, body: body || "", ctaUrl: ctaUrl || "", ctaLabel: ctaLabel || "Learn More", imageUrl, presentingBlurb },
    update: { sponsorId, headline, body: body || "", ctaUrl: ctaUrl || "", ctaLabel: ctaLabel || "Learn More", imageUrl, presentingBlurb },
    include: { sponsor: { select: { businessName: true, contactName: true, email: true } } },
  });

  return NextResponse.json({ booking });
}
