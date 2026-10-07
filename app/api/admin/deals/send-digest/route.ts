import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { sendWeeklyDigest, getPublishedDigestData } from "@/lib/deals/digest";
import { basePrisma } from "@/lib/db-base";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Preview the digest audience + content without sending.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const [data, buyerCount, lastSend] = await Promise.all([
    getPublishedDigestData(workspace.id),
    basePrisma.couponBookPurchase.count({
      where: { workspaceId: workspace.id, active: true, digestOptOut: false },
    }),
    basePrisma.dealDigestSend.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true, recipientCount: true, subject: true },
    }),
  ]);
  const dealCount = data.retailers.reduce((n, r) => n + r.deals.length, 0);
  return NextResponse.json({
    buyerCount,
    topPickCount: data.topPicks.length,
    retailerCount: data.retailers.length,
    dealCount,
    weekLabel: data.weekLabel,
    lastSend,
  });
}

// Send the weekly digest to all opted-in buyers, or a single test email.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  let testEmail: string | undefined;
  try {
    const body = await req.json();
    if (body?.testEmail) {
      const v = String(body.testEmail).trim().toLowerCase();
      if (!v.includes("@")) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
      }
      testEmail = v;
    }
  } catch {
    // No JSON body: full buyer send.
  }
  try {
    const result = await sendWeeklyDigest(workspace.id, testEmail ? { testEmail } : undefined);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
