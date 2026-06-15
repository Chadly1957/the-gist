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

  return NextResponse.json({ profile });
}
