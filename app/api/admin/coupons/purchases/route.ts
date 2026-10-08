import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET ?email= — search book purchases in this workspace. Returns each buyer's
// magic link so support can copy/resend it directly.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();

  const q = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() || "";
  const purchases = await basePrisma.couponBookPurchase.findMany({
    where: {
      workspaceId: workspace.id,
      ...(q ? { email: { contains: q } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      createdAt: true,
      active: true,
      stripeSessionId: true,
      magicToken: true,
    },
  });

  const ws = await basePrisma.workspace.findUnique({ where: { id: workspace.id } });
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const workspaceUrl = ws?.domain
    ? `https://${ws.domain}`
    : workspace.id === "decatur" || !ws?.slug
      ? base
      : `${base}/w/${ws.slug}`;

  return NextResponse.json({
    purchases: purchases.map((p) => ({
      id: p.id,
      email: p.email,
      createdAt: p.createdAt,
      active: p.active,
      paid: !!p.stripeSessionId,
      magicLink: `${workspaceUrl}/deals?token=${p.magicToken}`,
    })),
  });
}

// POST { purchaseId } — resend the magic link email. Reports failure honestly
// instead of swallowing it, so support knows whether it actually went out.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();

  const { purchaseId } = await req.json();
  const purchase = await basePrisma.couponBookPurchase.findFirst({
    where: { id: purchaseId, workspaceId: workspace.id },
  });
  if (!purchase) return NextResponse.json({ error: "Purchase not found." }, { status: 404 });

  try {
    const { sendCouponBookMagicLinkEmail } = await import("@/lib/coupon-book-email");
    await sendCouponBookMagicLinkEmail({
      workspaceId: workspace.id,
      to: purchase.email,
      magicToken: purchase.magicToken,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
