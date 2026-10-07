import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import QRCode from "qrcode";
import { getPublishedDigestData } from "@/lib/deals/digest";
import { getGasPrices } from "@/lib/deals/gas";
import { intervalStart, isRefreshInterval } from "@/lib/coupons/intervals";

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
      refreshInterval: true,
    },
  });

  const timeZone = workspace.timezone || "America/Chicago";
  const redemptionCounts = await basePrisma.couponRedemption.groupBy({
    by: ["couponId"],
    where: { workspaceId: workspace.id, purchaseId: purchase.id },
    _count: { couponId: true },
  });
  const usedCounts = Object.fromEntries(redemptionCounts.map((r) => [r.couponId, r._count.couponId]));

  // Renewing coupons: count only redemptions inside the current interval.
  const intervalCounts: Record<string, number> = {};
  const renewing = coupons.filter((c) => isRefreshInterval(c.refreshInterval));
  for (const c of renewing) {
    const start = intervalStart(c.refreshInterval as "daily" | "weekly" | "monthly", timeZone);
    intervalCounts[c.id] = await basePrisma.couponRedemption.count({
      where: { workspaceId: workspace.id, purchaseId: purchase.id, couponId: c.id, redeemedAt: { gte: start } },
    });
  }

  // This Week's Deals: latest published deal weeks + referral wallet links.
  const digestData = await getPublishedDigestData(workspace.id);
  const settingRows = await basePrisma.setting.findMany({ where: { workspaceId: workspace.id } });
  const settings = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));

  const couponsWithQr = await Promise.all(
    coupons.map(async (c) => {
      const renewingInterval = isRefreshInterval(c.refreshInterval) ? c.refreshInterval : null;
      const usedUp = renewingInterval
        ? (intervalCounts[c.id] ?? 0) >= 1
        : c.maxRedemptions != null && (usedCounts[c.id] ?? 0) >= c.maxRedemptions;
      return {
      ...c,
      redemptionsByMe: usedCounts[c.id] ?? 0,
      usedUp,
      // Unique QR per coupon: the cashier scans it, adds notes, and confirms.
      qrDataUrl: await QRCode.toDataURL(`${appUrl}/r/${purchase.buyerToken}/${c.id}`, {
        width: 360,
        margin: 1,
      }),
      };
    })
  );

  const gas = await getGasPrices(workspace.id);

  return NextResponse.json({
    email: purchase.email,
    dealsLogoUrl: workspace.dealsLogoUrl,
    dealsEmailHeaderUrl: workspace.dealsEmailHeaderUrl,
    gas,
    coupons: couponsWithQr,
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
