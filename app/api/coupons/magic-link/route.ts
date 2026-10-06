import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { sendCouponBookMagicLinkEmail } from "@/lib/coupon-book-email";

export const dynamic = "force-dynamic";

// Email the buyer their magic link ("resend my link" + post-purchase).
// Always returns the same message so addresses can't be enumerated.
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const workspace = await getWorkspace();
  const purchase = await basePrisma.couponBookPurchase.findFirst({
    where: { workspaceId: workspace.id, email: normalized, active: true },
    orderBy: { createdAt: "desc" },
  });

  if (purchase) {
    await sendCouponBookMagicLinkEmail({
      workspaceId: workspace.id,
      to: normalized,
      magicToken: purchase.magicToken,
    });
  }

  return NextResponse.json({
    message: "If that email bought a coupon book, we've sent your personal link.",
  });
}
