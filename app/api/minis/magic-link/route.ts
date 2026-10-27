import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import {
  sendCouponBookMagicLinkEmail,
  sendMiniMagicLinkEmail,
} from "@/lib/coupon-book-email";

export const dynamic = "force-dynamic";

// Email the requester their portal link ("resend my link"). Deals owners get
// the full-book link; guide-only owners get their guide portal link. Always
// returns the same message so addresses can't be enumerated.
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const normalized = email?.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const workspace = await getWorkspace();
  const dealsPurchase = await basePrisma.couponBookPurchase.findFirst({
    where: { workspaceId: workspace.id, email: normalized, active: true },
    orderBy: { createdAt: "desc" },
  });

  if (dealsPurchase) {
    await sendCouponBookMagicLinkEmail({
      workspaceId: workspace.id,
      to: normalized,
      magicToken: dealsPurchase.magicToken,
    });
  } else {
    const miniPurchase = await basePrisma.miniPurchase.findFirst({
      where: { workspaceId: workspace.id, email: normalized },
      orderBy: { createdAt: "desc" },
      include: { mini: { select: { title: true, slug: true } } },
    });
    if (miniPurchase) {
      await sendMiniMagicLinkEmail({
        workspaceId: workspace.id,
        to: normalized,
        magicToken: miniPurchase.magicToken,
        miniTitle: miniPurchase.mini.title,
        miniSlug: miniPurchase.mini.slug,
      });
    }
  }

  return NextResponse.json({
    message: "If that email has a Gist Deals Book or a guide, we've sent your personal link.",
  });
}
