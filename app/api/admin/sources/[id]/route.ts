import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const source = await prisma.source.update({
    where: { id },
    data: {
      ...(typeof body.active === "boolean" && { active: body.active }),
      ...(body.name && { name: body.name }),
      ...(body.url && { url: body.url }),
    },
  });
  return NextResponse.json({ source });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.source.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
