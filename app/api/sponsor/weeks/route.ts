import { getWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { WEEK_TIERS, getWeeksAvailability } from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Public availability for the next 8 sponsor weeks.
export async function GET() {
  const workspace = await getWorkspace();
  const weeks = await getWeeksAvailability(workspace.id);
  return NextResponse.json({
    weeks,
    tiers: {
      presenting: { priceCents: WEEK_TIERS.presenting.priceCents, slots: WEEK_TIERS.presenting.slots, label: WEEK_TIERS.presenting.label },
      standard: { priceCents: WEEK_TIERS.standard.priceCents, slots: WEEK_TIERS.standard.slots, label: WEEK_TIERS.standard.label },
    },
  });
}
