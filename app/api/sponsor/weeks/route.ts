import { getWorkspace } from "@/lib/workspace";
import { NextResponse } from "next/server";
import { WEEK_TIERS, campaignPriceCents, getWeeksAvailability, type WeekTier } from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Availability for the next 8 sponsor weeks. All tiers are returned (the
// admin sponsors page renders this strip too); buyer flows only offer the
// tiers that are on sale. The campaign price is per market.
export async function GET() {
  const workspace = await getWorkspace();
  const weeks = await getWeeksAvailability(workspace.id);
  return NextResponse.json({
    weeks,
    tiers: Object.fromEntries(
      (Object.keys(WEEK_TIERS) as WeekTier[]).map((t) => [
        t,
        {
          priceCents: t === "standard" ? campaignPriceCents(workspace.slug) : WEEK_TIERS[t].priceCents,
          slots: WEEK_TIERS[t].slots,
          label: WEEK_TIERS[t].label,
        },
      ])
    ),
  });
}
