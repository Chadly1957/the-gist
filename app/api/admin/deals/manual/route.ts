import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { createManualDeal } from "@/lib/deals/manual";

export const dynamic = "force-dynamic";

// Create a manual/evergreen deal (generic business-deal input).
// Used by the admin UI form AND programmatically (e.g. a side-chat agent
// filing deals on Chad's behalf). Same workspace scoping + validation.
//
// Body: { retailerSlug*, businessName?, title*, price?, regPrice?, category?,
//         summary?, dealUrl?, validFrom?, validTo?, isTopPick? }
// retailerSlug must be an active manual-pipeline retailer in this workspace
// (e.g. "business-deals", "rebates", "freebies", "gas").
// Manual deals go live immediately — Chad is the curator, no review queue.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  try {
    const deal = await createManualDeal(workspace.id, await req.json());
    return NextResponse.json({ deal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
