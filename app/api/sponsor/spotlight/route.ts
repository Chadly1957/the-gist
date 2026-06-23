import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { token, businessName, description, ctaUrl, ctaLabel, logoUrl } = await req.json();

  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  if (!businessName || !description || !ctaUrl) {
    return NextResponse.json({ error: "Business name, description, and CTA URL are required." }, { status: 400 });
  }

  if (description.length > 300) {
    return NextResponse.json({ error: "Description must be 300 characters or less." }, { status: 400 });
  }

  const listing = await prisma.spotlightListing.create({
    data: {
      sponsorId: profile.id,
      businessName: businessName.trim(),
      description: description.trim(),
      ctaUrl: ctaUrl.trim(),
      ctaLabel: ctaLabel?.trim() || "Visit Website",
      logoUrl: logoUrl?.trim() || null,
    },
  });

  return NextResponse.json({ listing });
}

export async function PATCH(req: NextRequest) {
  const { token, id, businessName, description, ctaUrl, ctaLabel, logoUrl } = await req.json();

  if (!token || !id) return NextResponse.json({ error: "Token and listing ID required." }, { status: 400 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const existing = await prisma.spotlightListing.findFirst({ where: { id, sponsorId: profile.id } });
  if (!existing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  if (!businessName || !description || !ctaUrl) {
    return NextResponse.json({ error: "Business name, description, and CTA URL are required." }, { status: 400 });
  }
  if (description.length > 300) {
    return NextResponse.json({ error: "Description must be 300 characters or less." }, { status: 400 });
  }

  const updated = await prisma.spotlightListing.update({
    where: { id },
    data: {
      businessName: businessName.trim(),
      description: description.trim(),
      ctaUrl: ctaUrl.trim(),
      ctaLabel: ctaLabel?.trim() || "Visit Website",
      logoUrl: logoUrl?.trim() || null,
    },
  });

  return NextResponse.json({ listing: updated });
}
