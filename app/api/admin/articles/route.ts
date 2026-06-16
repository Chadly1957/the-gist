import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const articles = await prisma.article.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ articles });
}

export async function DELETE() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.article.deleteMany({});

  return NextResponse.json({ ok: true });
}
