import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// One-click opt-out from the weekly buyer digest (footer link in each digest).
// The buyer keeps their Gist Deals Book — this only stops the weekly email.
export async function POST(req: NextRequest) {
  const workspace = await getWorkspace();
  const { token } = await req.json().catch(() => ({} as { token?: string }));
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 400 });

  const purchase = await basePrisma.couponBookPurchase.findFirst({
    where: { workspaceId: workspace.id, magicToken: token, active: true },
    select: { id: true },
  });
  if (!purchase) return NextResponse.json({ error: "Invalid link." }, { status: 404 });

  await basePrisma.couponBookPurchase.update({
    where: { id: purchase.id },
    data: { digestOptOut: true },
  });
  return NextResponse.json({ ok: true });
}
