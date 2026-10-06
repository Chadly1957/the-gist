import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { sendCouponRedemptionEmail } from "@/lib/coupon-book-email";

export const dynamic = "force-dynamic";

// Cashier flow: scan the buyer's QR (buyerToken, no login), tap a coupon.
// One-time coupons are enforced server-side inside a transaction.
export async function POST(req: NextRequest) {
  const { buyerToken, couponId } = await req.json();
  if (!buyerToken || !couponId) {
    return NextResponse.json({ error: "Missing token or coupon." }, { status: 400 });
  }

  const purchase = await basePrisma.couponBookPurchase.findUnique({
    where: { buyerToken },
    select: { id: true, workspaceId: true, email: true, active: true },
  });
  if (!purchase || !purchase.active) {
    return NextResponse.json({ error: "This coupon book isn't valid." }, { status: 404 });
  }

  const result = await basePrisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findFirst({
      where: { id: couponId, workspaceId: purchase.workspaceId, active: true },
    });
    if (!coupon) return { ok: false as const, error: "Coupon not found or no longer active.", status: 404 };

    if (coupon.maxRedemptions != null) {
      const used = await tx.couponRedemption.count({
        where: { workspaceId: purchase.workspaceId, couponId: coupon.id, purchaseId: purchase.id },
      });
      if (used >= coupon.maxRedemptions) {
        return { ok: false as const, error: "This coupon has already been used.", status: 409 };
      }
    }

    const redemption = await tx.couponRedemption.create({
      data: {
        workspaceId: purchase.workspaceId,
        couponId: coupon.id,
        purchaseId: purchase.id,
      },
    });
    return { ok: true as const, redemption, coupon };
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  // Notify the business owner (fire and forget; the redemption is already logged).
  if (result.coupon.contactEmail) {
    await sendCouponRedemptionEmail({
      workspaceId: purchase.workspaceId,
      to: result.coupon.contactEmail,
      businessName: result.coupon.businessName,
      couponTitle: result.coupon.title,
      buyerEmail: purchase.email,
    });
  }

  return NextResponse.json({
    ok: true,
    couponTitle: result.coupon.title,
    businessName: result.coupon.businessName,
    redeemedAt: result.redemption.redeemedAt,
  });
}
