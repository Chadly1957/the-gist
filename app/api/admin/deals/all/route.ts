import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Cross-workspace deals browser for the admin Deals page ("All deals" tab).
// Everything here is read-only and explicitly filtered — the scoped `prisma`
// client cannot go cross-workspace, so this uses the unscoped base client.
// Filters: workspace (slug), retailer (id), week (id), status (published|draft),
// q (title/business search), page.
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceSlug = searchParams.get("workspace") || "all";
  const retailerId = searchParams.get("retailer") || "";
  const weekId = searchParams.get("week") || "";
  const status = searchParams.get("status") || "";
  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = 50;

  const where: any = {};
  if (workspaceSlug !== "all") {
    const ws = await basePrisma.workspace.findUnique({
      where: { slug: workspaceSlug },
      select: { id: true },
    });
    if (!ws) return NextResponse.json({ error: "Unknown workspace." }, { status: 400 });
    where.workspaceId = ws.id;
  }
  if (weekId) where.dealWeekId = weekId;
  const weekFilter: any = {};
  if (retailerId) weekFilter.retailerId = retailerId;
  if (status === "published" || status === "draft") weekFilter.status = status;
  if (Object.keys(weekFilter).length > 0) where.dealWeek = weekFilter;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { businessName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [deals, total] = await Promise.all([
    basePrisma.deal.findMany({
      where,
      include: {
        workspace: { select: { slug: true, name: true } },
        dealWeek: {
          select: {
            id: true,
            weekStart: true,
            weekEnd: true,
            status: true,
            retailer: { select: { id: true, displayName: true, slug: true } },
          },
        },
      },
      orderBy: [{ dealWeek: { weekStart: "desc" } }, { sortOrder: "asc" }],
      take: limit,
      skip: (page - 1) * limit,
    }),
    basePrisma.deal.count({ where }),
  ]);

  return NextResponse.json({ deals, total, page, limit });
}
