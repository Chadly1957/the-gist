import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = ["name", "startDate", "endDate", "goal", "prizeDescription", "status"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === "goal" ? parseInt(String(body[key])) : body[key];
    }
  }

  const sprint = await db.referralSprint.update({ where: { id: params.id }, data });
  return NextResponse.json({ sprint });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.referralSprint.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
