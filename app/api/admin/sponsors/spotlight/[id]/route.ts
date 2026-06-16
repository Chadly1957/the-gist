import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, businessName, logoUrl, description, ctaLabel, ctaUrl } = body;

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
