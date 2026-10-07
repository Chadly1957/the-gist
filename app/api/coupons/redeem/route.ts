import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { sendCouponRedemptionEmail } from "@/lib/coupon-book-email";
import { intervalStart, isRefreshInterval, refreshesLabel } from "@/lib/coupons/intervals";

export const dynamic = "force-dynamic";

// Cashier flow: scan a coupon's unique QR (buyerToken + couponId, no login),
// optionally add notes, and confirm. One-time coupons are enforced
// server-side inside a transaction.
export async function POST(req: NextRequest) {
  const { buyerToken, couponId, notes } = await req.json();
  if (!buyerToken || !couponId) {
    return NextResponse.json({ error: "Missing token or coupon." }, { status: 400 });
  }
  const cleanNotes = typeof notes === "string" ? notes.trim().slice(0, 500) : "";

  const purchase = await basePrisma.couponBookPurchase.findUnique({
    where: { buyerToken },
    select: { id: true, workspaceId: true, email: true, active: true },
  });
  if (!purchase || !purchase.active) {
    return NextResponse.json({ error: "This Gist Deals Book isn't valid." }, { status: 404 });
  }

  const ws = await basePrisma.workspace.findUnique({
    where: { id: purchase.workspaceId },
    select: { timezone: true },
  });
  const timeZone = ws?.timezone || "America/Chicago";

  const result = await basePrisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findFirst({
      where: { id: couponId, workspaceId: purchase.workspaceId, active: true },
    });
    if (!coupon) return { ok: false as const, error: "Coupon not found or no longer active.", status: 404 };

    if (isRefreshInterval(coupon.refreshInterval)) {
      // Renewing coupon: one redemption per interval.
      const start = intervalStart(coupon.refreshInterval, timeZone);
      const used = await tx.couponRedemption.count({
        where: {
          workspaceId: purchase.workspaceId,
          couponId: coupon.id,
          purchaseId: purchase.id,
          redeemedAt: { gte: start },
        },
      });
      if (used >= 1) {
        return {
          ok: false as const,
          error: `Already used — this coupon refreshes ${refreshesLabel(coupon.refreshInterval)}.`,
          status: 409,
        };
      }
    } else if (coupon.maxRedemptions != null) {
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
        notes: cleanNotes,
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
      redeemedAt: result.redemption.redeemedAt,
      notes: cleanNotes,
    });
  }

  return NextResponse.json({
    ok: true,
    couponTitle: result.coupon.title,
    businessName: result.coupon.businessName,
    redeemedAt: result.redemption.redeemedAt,
  });
}
