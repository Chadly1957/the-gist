import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Deals customers (Deals book purchases) for the admin Lists page.
// ?scope=all spans every workspace; otherwise scoped to the current one.
// Read-only: id, email, createdAt, active, digestOptOut, workspace.
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceParam = searchParams.get("workspace") || "";
  const scopeAll = searchParams.get("scope") === "all" || workspaceParam === "all";
  const search = (searchParams.get("search") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = 50;

  const where: any = {};
  if (!scopeAll) {
    if (workspaceParam) {
      const ws = await basePrisma.workspace.findUnique({
        where: { slug: workspaceParam },
        select: { id: true },
      });
      if (!ws) return NextResponse.json({ error: "Unknown workspace." }, { status: 400 });
      where.workspaceId = ws.id;
    } else {
      where.workspaceId = (await getWorkspace()).id;
    }
  }
  if (search) where.email = { contains: search, mode: "insensitive" };

  const [customers, total] = await Promise.all([
    basePrisma.couponBookPurchase.findMany({
      where,
      select: {
        id: true,
        email: true,
        createdAt: true,
        active: true,
        digestOptOut: true,
        workspace: { select: { slug: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    basePrisma.couponBookPurchase.count({ where }),
  ]);

  return NextResponse.json({ customers, total, page, limit });
}
