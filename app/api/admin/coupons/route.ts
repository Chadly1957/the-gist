import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coupons = await prisma.coupon.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { redemptions: true } } },
  });
  const purchaseCount = await prisma.couponBookPurchase.count({ where: { active: true } });
  return NextResponse.json({ coupons, purchaseCount });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessName, title, description, terms, maxRedemptions, contactEmail, sortOrder, active } =
    await req.json();
  if (!businessName?.trim() || !title?.trim()) {
    return NextResponse.json({ error: "Business name and title are required." }, { status: 400 });
  }

  const coupon = await prisma.coupon.create({
    data: {
      businessName: businessName.trim(),
      title: title.trim(),
      description: (description || "").trim(),
      terms: (terms || "").trim(),
      maxRedemptions: maxRedemptions === 1 ? 1 : null,
      contactEmail: contactEmail?.trim().toLowerCase() || null,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      active: active !== false,
    },
  });
  return NextResponse.json({ coupon });
}
