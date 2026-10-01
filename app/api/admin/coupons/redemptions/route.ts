import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Recent redemptions across the workspace, newest first.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const redemptions = await prisma.couponRedemption.findMany({
    orderBy: { redeemedAt: "desc" },
    take: 200,
    include: {
      coupon: { select: { businessName: true, title: true } },
      purchase: { select: { email: true } },
    },
  });
  return NextResponse.json({ redemptions });
}
