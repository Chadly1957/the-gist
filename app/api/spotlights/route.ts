import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const spotlights = await prisma.spotlightListing.findMany({
    where: { status: "approved" },
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      ctaLabel: true,
      ctaUrl: true,
      description: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(spotlights);
}
