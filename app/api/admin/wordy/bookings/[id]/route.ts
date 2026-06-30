import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  const fields = ["status","isPaid","adminNotes","headline","body","ctaUrl","ctaLabel","imageUrl","presentingBlurb","sponsorId"];
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }
  if (body.status === "approved") data.approvedAt = new Date();

  const booking = await prisma.wordyBooking.update({
    where: { id: params.id },
    data,
    include: { sponsor: { select: { businessName: true, contactName: true, email: true } } },
  });

  return NextResponse.json({ booking });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.wordyBooking.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
