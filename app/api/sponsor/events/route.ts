import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const events = await db.event.findMany({
    where: { sponsorId: profile.id },
    orderBy: { eventDate: "asc" },
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const { token, title, description, eventDate, startTime, endTime, location, url, cost } = await req.json();

  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  if (!title?.trim() || !eventDate) {
    return NextResponse.json({ error: "Title and date are required." }, { status: 400 });
  }

  const event = await db.event.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      eventDate,
      startTime: startTime?.trim() || null,
      endTime: endTime?.trim() || null,
      location: location?.trim() || null,
      url: url?.trim() || null,
      cost: cost?.trim() || null,
      status: "approved",
      approvedAt: new Date(),
      sponsorId: profile.id,
    },
  });

  return NextResponse.json({ event });
}
