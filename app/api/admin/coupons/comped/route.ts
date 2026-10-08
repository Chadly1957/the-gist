import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { basePrisma } from "@/lib/db-base";
import { sendCouponBookMagicLinkEmail } from "@/lib/coupon-book-email";

export const dynamic = "force-dynamic";

// Comp a Gist Deals Book: add a buyer free of charge (no Stripe). Creates an active
// lifetime purchase and emails them their magic link. Idempotent per email:
// if they already have an active book, we just resend the link.
// Also used to manually record a paid purchase whose Stripe webhook never
// arrived: pass stripeSessionId and the buyer shows as paid, not comped.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const { email, stripeSessionId } = (await req.json().catch(() => ({}))) as {
    email?: string;
    stripeSessionId?: string;
  };
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  let purchase = await basePrisma.couponBookPurchase.findFirst({
    where: { workspaceId: workspace.id, email: normalized, active: true },
    orderBy: { createdAt: "desc" },
  });
  let created = false;
  if (!purchase) {
    purchase = await basePrisma.couponBookPurchase.create({
      data: {
        workspaceId: workspace.id,
        email: normalized,
        stripeSessionId: stripeSessionId?.trim() || undefined,
        active: true,
        isLifetime: true,
      },
    });
    created = true;
  } else if (stripeSessionId?.trim() && !purchase.stripeSessionId) {
    // Backfill the Stripe session on an existing record (missed webhook).
    purchase = await basePrisma.couponBookPurchase.update({
      where: { id: purchase.id },
      data: { stripeSessionId: stripeSessionId.trim() },
    });
  }

  try {
    await sendCouponBookMagicLinkEmail({
      workspaceId: workspace.id,
      to: normalized,
      magicToken: purchase.magicToken,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Book ${created ? "created" : "found"}, but the email failed to send.`, magicToken: purchase.magicToken },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, created, email: normalized, magicToken: purchase.magicToken });
}
