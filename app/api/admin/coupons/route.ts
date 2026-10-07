import { NextRequest, NextResponse } from "next/server";
import { isRefreshInterval } from "@/lib/coupons/intervals";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const coupons = await prisma.coupon.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { redemptions: true } } },
  });
  const purchaseCount = await prisma.couponBookPurchase.count({
    where: { workspaceId: workspace.id, active: true },
  });
  return NextResponse.json({ coupons, purchaseCount });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const { businessName, title, description, terms, maxRedemptions, refreshInterval, contactEmail, sortOrder, active } =
    await req.json();
  if (!businessName?.trim() || !title?.trim()) {
    return NextResponse.json({ error: "Business name and title are required." }, { status: 400 });
  }

  const coupon = await prisma.coupon.create({
    data: {
      workspaceId: workspace.id,
      businessName: businessName.trim(),
      title: title.trim(),
      description: (description || "").trim(),
      terms: (terms || "").trim(),
      maxRedemptions: isRefreshInterval(refreshInterval) ? null : maxRedemptions === 1 ? 1 : null,
      refreshInterval: isRefreshInterval(refreshInterval) ? refreshInterval : null,
      contactEmail: contactEmail?.trim().toLowerCase() || null,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      active: active !== false,
    },
  });
  return NextResponse.json({ coupon });
}
