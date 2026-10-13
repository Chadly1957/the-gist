import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// List DealWeeks for the current workspace (newest first).
// ?scope=all returns every workspace's weeks (for the All-deals browser).
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (new URL(req.url).searchParams.get("scope") === "all") {
    const weeks = await basePrisma.dealWeek.findMany({
      orderBy: [{ weekStart: "desc" }, { retailer: { displayName: "asc" } }],
      include: {
        workspace: { select: { slug: true, name: true } },
        retailer: { select: { id: true, displayName: true, slug: true, pipeline: true } },
        _count: { select: { deals: true } },
      },
      take: 150,
    });
    return NextResponse.json({ weeks, scope: "all" });
  }

  const workspace = await getWorkspace();
  const weeks = await prisma.dealWeek.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ weekStart: "desc" }, { retailer: { displayName: "asc" } }],
    include: {
      retailer: { select: { displayName: true, slug: true, pipeline: true } },
      _count: { select: { deals: true } },
    },
    take: 60,
  });
  return NextResponse.json({ weeks });
}
