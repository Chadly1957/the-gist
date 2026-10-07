import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import QRCode from "qrcode";
import { getPublishedDigestData } from "@/lib/deals/digest";

export const dynamic = "force-dynamic";

// Reader dashboard data: the buyer's QR code (encodes the cashier URL),
// the coupon list, and per-coupon usage for one-time coupons.
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 400 });

  const workspace = await getWorkspace();
  const purchase = await basePrisma.couponBookPurchase.findFirst({
    where: { workspaceId: workspace.id, magicToken: token, active: true },
    select: { id: true, email: true, buyerToken: true, createdAt: true },
  });
  if (!purchase) return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });

  const appUrl = await getWorkspaceUrl();
  const cashierUrl = `${appUrl}/b/${purchase.buyerToken}`;
  const qrDataUrl = await QRCode.toDataURL(cashierUrl, { width: 480, margin: 1 });

  const coupons = await basePrisma.coupon.findMany({
    where: { workspaceId: workspace.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      businessName: true,
      title: true,
      description: true,
      terms: true,
      maxRedemptions: true,
    },
  });

  const redemptionCounts = await basePrisma.couponRedemption.groupBy({
    by: ["couponId"],
    where: { workspaceId: workspace.id, purchaseId: purchase.id },
    _count: { couponId: true },
  });
  const usedCounts = Object.fromEntries(redemptionCounts.map((r) => [r.couponId, r._count.couponId]));

  // This Week's Deals: latest published deal weeks + referral wallet links.
  const digestData = await getPublishedDigestData(workspace.id);
  const settingRows = await basePrisma.setting.findMany({ where: { workspaceId: workspace.id } });
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));

  return NextResponse.json({
    email: purchase.email,
    cashierUrl,
    qrDataUrl,
    dealsLogoUrl: workspace.dealsLogoUrl,
    coupons: coupons.map((c) => ({
      ...c,
      redemptionsByMe: usedCounts[c.id] ?? 0,
      usedUp: c.maxRedemptions != null && (usedCounts[c.id] ?? 0) >= c.maxRedemptions,
    })),
    deals: {
      topPicks: digestData.topPicks,
      retailers: digestData.retailers,
      weekLabel: digestData.weekLabel,
    },
    referrals: {
      rakuten: settings["deals_referral_rakuten"] || "",
      ibotta: settings["deals_referral_ibotta"] || "",
      note: settings["deals_referral_note"] || "",
    },
  });
}
