import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { refreshRetailer, refreshAllRetailers } from "@/lib/deals/refresh";

export const dynamic = "force-dynamic";
// Fetchers can take a while across 5 retailers.
export const maxDuration = 300;

// One-click weekly refresh: run fetchers into draft DealWeeks.
// Body: { retailerId? } — omit to refresh all automated retailers.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const { retailerId } = (await req.json().catch(() => ({}))) as { retailerId?: string };

  try {
    const outcomes = retailerId
      ? [await refreshRetailer(workspace.id, retailerId)]
      : await refreshAllRetailers(workspace.id);
    return NextResponse.json({ outcomes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
