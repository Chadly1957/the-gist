import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [spotlights, bookings, profiles] = await Promise.all([
    prisma.spotlightListing.findMany({
      orderBy: { createdAt: "desc" },
      include: { sponsor: { select: { businessName: true, contactName: true, email: true, magicToken: true } } },
    }),
    prisma.adBooking.findMany({
      orderBy: { date: "asc" },
      include: { sponsor: { select: { businessName: true, contactName: true, email: true } } },
    }),
    prisma.sponsorProfile.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, businessName: true, contactName: true, email: true, phone: true, website: true, magicToken: true, active: true, notes: true, createdAt: true },
    }),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  return NextResponse.json({
    spotlights,
    bookings,
    profiles: profiles.map((p) => ({ ...p, portalUrl: `${appUrl}/sponsor/portal?token=${p.magicToken}` })),
  });
}
