import { basePrisma } from "@/lib/db-base";
import { intervalStart, isRefreshInterval } from "@/lib/coupons/intervals";
import { notFound } from "next/navigation";
import RedeemClient from "./RedeemClient";

export const dynamic = "force-dynamic";

// Cashier scan target: each coupon in a buyer's book has a unique QR pointing
// here. No login — the unguessable buyerToken in the URL is the credential.
// The cashier sees the coupon, adds an optional note, and confirms.
export default async function RedeemPage({
  params,
}: {
  params: { buyerToken: string; couponId: string };
}) {
  const purchase = await basePrisma.couponBookPurchase.findUnique({
    where: { buyerToken: params.buyerToken },
    select: { id: true, workspaceId: true, email: true, active: true },
  });
  if (!purchase || !purchase.active) notFound();

  const ws = await basePrisma.workspace.findUnique({
    where: { id: purchase.workspaceId },
    select: { timezone: true },
  });
  const timeZone = ws?.timezone || "America/Chicago";

  const coupon = await basePrisma.coupon.findFirst({
    where: { id: params.couponId, workspaceId: purchase.workspaceId, active: true },
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
  if (!coupon) notFound();

  let usedUp = false;
  if (isRefreshInterval(coupon.refreshInterval)) {
    const start = intervalStart(coupon.refreshInterval, timeZone);
    const used = await basePrisma.couponRedemption.count({
      where: {
        workspaceId: purchase.workspaceId,
        couponId: coupon.id,
        purchaseId: purchase.id,
        redeemedAt: { gte: start },
      },
    });
    usedUp = used >= 1;
  } else if (coupon.maxRedemptions != null) {
    const used = await basePrisma.couponRedemption.count({
      where: { workspaceId: purchase.workspaceId, couponId: coupon.id, purchaseId: purchase.id },
    });
    usedUp = used >= coupon.maxRedemptions;
  }

  return (
    <RedeemClient
      buyerToken={params.buyerToken}
      buyerEmail={purchase.email}
      coupon={coupon}
      usedUp={usedUp}
    />
  );
}
