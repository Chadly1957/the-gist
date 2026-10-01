import { basePrisma } from "@/lib/db-base";
import CashierRedeem from "@/components/coupons/CashierRedeem";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Public cashier page: the buyer's QR code opens this URL. No login — the
// unguessable buyerToken in the URL is the credential.
export default async function CashierPage({ params }: { params: { token: string } }) {
  const purchase = await basePrisma.couponBookPurchase.findUnique({
    where: { buyerToken: params.token },
    select: { id: true, workspaceId: true, active: true },
  });
  if (!purchase || !purchase.active) notFound();

  const coupons = await basePrisma.coupon.findMany({
    where: { workspaceId: purchase.workspaceId, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, businessName: true, title: true, description: true, terms: true, maxRedemptions: true },
  });

  return <CashierRedeem buyerToken={params.token} coupons={coupons} />;
}
