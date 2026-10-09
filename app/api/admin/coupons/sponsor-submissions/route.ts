import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Everything sponsors created themselves in their sponsor portals:
// - coupons (Coupon rows with sponsorId set)
// - deals (Deal rows under a sponsor-owned Retailer row)
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();

  const [coupons, deals] = await Promise.all([
    prisma.coupon.findMany({
      where: { workspaceId: workspace.id, sponsorId: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { sponsor: { select: { businessName: true } } },
    }),
    prisma.deal.findMany({
      where: {
        workspaceId: workspace.id,
        dealWeek: { retailer: { sponsorId: { not: null } } },
      },
      orderBy: { dealWeek: { fetchedAt: "desc" } },
      include: {
        dealWeek: {
          select: {
            weekStart: true,
            weekEnd: true,
            status: true,
            retailer: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ coupons, deals });
}
