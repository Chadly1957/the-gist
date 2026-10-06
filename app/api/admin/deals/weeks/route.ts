import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// List DealWeeks for the current workspace (newest first).
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weeks = await prisma.dealWeek.findMany({
    orderBy: [{ weekStart: "desc" }, { retailer: { displayName: "asc" } }],
    include: {
      retailer: { select: { displayName: true, slug: true, pipeline: true } },
      _count: { select: { deals: true } },
    },
    take: 60,
  });
  return NextResponse.json({ weeks });
}
