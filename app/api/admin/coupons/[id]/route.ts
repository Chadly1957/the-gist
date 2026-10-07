import { NextRequest, NextResponse } from "next/server";
import { isRefreshInterval } from "@/lib/coupons/intervals";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const existing = await prisma.coupon.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
  });
  if (!existing) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });

  const { businessName, title, description, terms, maxRedemptions, refreshInterval, contactEmail, sortOrder, active } =
    await req.json();

  const data: Record<string, unknown> = {};
  if (businessName !== undefined) data.businessName = businessName.trim();
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = (description || "").trim();
  if (terms !== undefined) data.terms = (terms || "").trim();
  if (refreshInterval !== undefined) {
    data.refreshInterval = isRefreshInterval(refreshInterval) ? refreshInterval : null;
    if (isRefreshInterval(refreshInterval)) data.maxRedemptions = null;
  } else if (maxRedemptions !== undefined) data.maxRedemptions = maxRedemptions === 1 ? 1 : null;
  if (contactEmail !== undefined) data.contactEmail = contactEmail?.trim().toLowerCase() || null;
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) data.sortOrder = Number(sortOrder);
  if (active !== undefined) data.active = !!active;

  try {
    const coupon = await prisma.coupon.update({ where: { id: params.id }, data });
    return NextResponse.json({ coupon });
  } catch {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const existing = await prisma.coupon.findFirst({
    where: { id: params.id, workspaceId: workspace.id },
  });
  if (!existing) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });

  // Never hard-delete a coupon that has redemptions; deactivate it instead.
  const redemptionCount = await prisma.couponRedemption.count({ where: { couponId: params.id } });
  if (redemptionCount > 0) {
    await prisma.coupon.update({ where: { id: params.id }, data: { active: false } });
    return NextResponse.json({ deactivated: true });
  }
  try {
    await prisma.coupon.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  }
}
