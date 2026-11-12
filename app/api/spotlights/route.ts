import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.spotlightListing.findMany({
    where: { status: { in: ["approved", "active"] } },
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      ctaLabel: true,
      ctaUrl: true,
      description: true,
      // The listing is the placement row; the business copy comes from
      // the profile (single source of truth, unified 2026-11-12). The
      // listing columns are legacy snapshots kept as a fallback.
      sponsor: {
        select: { businessName: true, logoUrl: true, description: true, website: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const spotlights = rows.map(({ sponsor, ...r }) => ({
    ...r,
    businessName: sponsor.businessName,
    logoUrl: sponsor.logoUrl ?? r.logoUrl,
    description: sponsor.description ?? r.description,
    ctaUrl: sponsor.website ?? r.ctaUrl,
  }));

  return NextResponse.json(spotlights);
}
