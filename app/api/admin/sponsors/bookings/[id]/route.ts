import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, isPaid, adminNotes } = body;

  const data: Record<string, unknown> = {};
  if (status !== undefined) {
    data.status = status;
    if (status === "approved") data.approvedAt = new Date();
  }
  if (isPaid !== undefined) data.isPaid = isPaid;
  if (adminNotes !== undefined) data.adminNotes = adminNotes;

  const updated = await prisma.adBooking.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ booking: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.adBooking.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
