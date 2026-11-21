import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { sendRewardsPortalLinkEmail } from "@/lib/rewards-email";

export const dynamic = "force-dynamic";

// Email a subscriber their personal Rewards link ("send me my link" from
// the homepage Rewards section and the /rewards page). Modeled on
// /api/coupons/magic-link: always returns the same message so addresses
// can't be enumerated.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized || !normalized.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const workspace = await getWorkspace();
  const subscriber = await basePrisma.subscriber.findFirst({
    where: { workspaceId: workspace.id, email: normalized, active: true },
    select: { id: true },
  });

  if (subscriber) {
    await sendRewardsPortalLinkEmail({
      workspaceId: workspace.id,
      to: normalized,
    });
  }

  return NextResponse.json({
    message: "If that email is subscribed, we've sent your personal Rewards link.",
  });
}
