import { basePrisma } from "@/lib/db-base";
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

  const coupon = await basePrisma.coupon.findFirst({
    where: { id: params.couponId, workspaceId: purchase.workspaceId, active: true },
    select: {
      id: true,
      businessName: true,
      title: true,
      description: true,
      terms: true,
      maxRedemptions: true,
    },
  });
  if (!coupon) notFound();

  let usedCount = 0;
  if (coupon.maxRedemptions != null) {
    usedCount = await basePrisma.couponRedemption.count({
      where: { workspaceId: purchase.workspaceId, couponId: coupon.id, purchaseId: purchase.id },
    });
  }
  const usedUp = coupon.maxRedemptions != null && usedCount >= coupon.maxRedemptions;

  return (
    <RedeemClient
      buyerToken={params.buyerToken}
      buyerEmail={purchase.email}
      coupon={coupon}
      usedUp={usedUp}
    />
  );
}
