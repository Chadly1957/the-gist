import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, notes } = body;

  const data: Record<string, unknown> = {};
  if (status) {
    data.status = status;
    if (status === "approved") data.approvedAt = new Date();
  }
  if (notes !== undefined) data.adminNotes = notes;

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
