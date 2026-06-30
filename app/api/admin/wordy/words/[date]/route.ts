import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { date: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.wordyWord.deleteMany({ where: { date: params.date } });
  return NextResponse.json({ ok: true });
}
