import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const workspaceParam = searchParams.get("workspace") || "";
  const scopeAll = searchParams.get("scope") === "all" || workspaceParam === "all";
  const limit = 50;

  const searchFilter = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { firstName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  if (scopeAll || workspaceParam) {
    // Cross-workspace (or explicit-workspace) view for the Lists page. Uses
    // the unscoped client with an explicit filter (the scoped `prisma`
    // client cannot go cross-workspace).
    const where: any = {};
    if (workspaceParam && workspaceParam !== "all") {
      const ws = await basePrisma.workspace.findUnique({
        where: { slug: workspaceParam },
        select: { id: true },
      });
      if (!ws) return NextResponse.json({ error: "Unknown workspace." }, { status: 400 });
      where.workspaceId = ws.id;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
      ];
    }
    const [subscribers, total] = await Promise.all([
      basePrisma.subscriber.findMany({
        where,
        include: { workspace: { select: { slug: true, name: true } } },
        orderBy: { subscribedAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      basePrisma.subscriber.count({ where }),
    ]);
    return NextResponse.json({ subscribers, total, page, limit, scope: "all" });
  }

  const where = searchFilter;

  const [subscribers, total] = await Promise.all([
    prisma.subscriber.findMany({
      where,
      orderBy: { subscribedAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.subscriber.count({ where }),
  ]);

  return NextResponse.json({ subscribers, total, page, limit });
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await prisma.subscriber.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
