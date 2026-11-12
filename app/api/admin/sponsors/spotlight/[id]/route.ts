import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { isPartnerCategory } from "@/lib/partner-categories";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, businessName, logoUrl, description, ctaLabel, ctaUrl, category } = body;

  if (typeof description === "string" && description.length > 300) {
    return NextResponse.json({ error: "Description must be 300 characters or less." }, { status: 400 });
  }

  const listing = await prisma.spotlightListing.findUnique({ where: { id: params.id } });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    if (status === "approved") data.approvedAt = new Date();
  }
  if (businessName !== undefined) data.businessName = businessName;
  if (logoUrl !== undefined) data.logoUrl = logoUrl;
  if (description !== undefined) data.description = description;
  if (ctaLabel !== undefined) data.ctaLabel = ctaLabel;
  if (ctaUrl !== undefined) data.ctaUrl = ctaUrl;
  if (category !== undefined) data.category = isPartnerCategory(category) ? category : null;

  // Admin edits write the PROFILE (single source of truth) for the
  // business fields and keep the listing's snapshot in sync (legacy
  // columns, see schema). Only status/ctaLabel live on the listing
  // itself.
  const profileData: Record<string, unknown> = {};
  if (businessName !== undefined) profileData.businessName = businessName;
  if (logoUrl !== undefined) profileData.logoUrl = logoUrl;
  if (description !== undefined) profileData.description = description;
  if (ctaUrl !== undefined) profileData.website = ctaUrl;
  if (category !== undefined) profileData.category = isPartnerCategory(category) ? category : null;
  if (Object.keys(profileData).length > 0) {
    await prisma.sponsorProfile.update({ where: { id: listing.sponsorId }, data: profileData });
  }

  const updated = await prisma.spotlightListing.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ listing: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.spotlightListing.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
