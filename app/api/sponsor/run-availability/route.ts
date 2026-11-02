import { NextRequest, NextResponse } from "next/server";
import { getWorkspace } from "@/lib/workspace";
import { basePrisma } from "@/lib/db-base";
import {
  CAMPAIGN_BUNDLE_PRICE_CENTS,
  CAMPAIGN_BUNDLE_SLUGS,
  WEEK_TIERS,
  campaignPriceCents,
  formatWeekRange,
  getRunAvailability,
  isBookableStartDate,
} from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Availability for a buyer-chosen campaign start day: the run is the 7
// consecutive daily issues from that date. With bundle=1, the same run
// must be open in BOTH bundle markets.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  if (!isBookableStartDate(start)) {
    return NextResponse.json(
      { error: "Pick a start day between tomorrow and 8 weeks out." },
      { status: 400 }
    );
  }

  if (searchParams.get("bundle") !== "1") {
    const workspace = await getWorkspace();
    const avail = await getRunAvailability(workspace.id, start, "standard");
    return NextResponse.json({
      start,
      label: formatWeekRange(start),
      state: avail.state,
      taken: avail.taken,
      slots: avail.slots,
      spotsLeft: avail.spotsLeft,
      priceCents: campaignPriceCents(workspace.slug),
    });
  }

  const workspaces = await basePrisma.workspace.findMany({
    where: { slug: { in: [...CAMPAIGN_BUNDLE_SLUGS] } },
  });
  if (workspaces.length !== CAMPAIGN_BUNDLE_SLUGS.length) {
    return NextResponse.json({ error: "Bundle is not available right now." }, { status: 503 });
  }
  const per = await Promise.all(
    CAMPAIGN_BUNDLE_SLUGS.map(async (slug) => {
      const ws = workspaces.find((w) => w.slug === slug)!;
      return getRunAvailability(ws.id, start, "standard");
    })
  );
  const state = per.some((a) => a.state === "sold")
    ? "sold"
    : per.some((a) => a.state === "one_left")
      ? "one_left"
      : "available";
  return NextResponse.json({
    start,
    label: formatWeekRange(start),
    state,
    taken: Math.max(...per.map((a) => a.taken)),
    slots: WEEK_TIERS.standard.slots,
    spotsLeft: Math.min(...per.map((a) => a.spotsLeft)),
    priceCents: CAMPAIGN_BUNDLE_PRICE_CENTS,
  });
}
