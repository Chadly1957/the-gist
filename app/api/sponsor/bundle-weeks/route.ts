import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import {
  CAMPAIGN_BUNDLE_PRICE_CENTS,
  CAMPAIGN_BUNDLE_SLUGS,
  campaignPriceCents,
  formatWeekRange,
  getWeeksAvailability,
} from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Both-cities bundle availability: a week is offered only when the
// 7-Issue Featured Campaign has a free slot in BOTH markets that week.
export async function GET() {
  const workspaces = await basePrisma.workspace.findMany({
    where: { slug: { in: [...CAMPAIGN_BUNDLE_SLUGS] } },
  });
  if (workspaces.length !== CAMPAIGN_BUNDLE_SLUGS.length) {
    return NextResponse.json({ error: "Bundle is not available right now." }, { status: 503 });
  }

  const perWorkspace = await Promise.all(
    CAMPAIGN_BUNDLE_SLUGS.map(async (slug) => {
      const ws = workspaces.find((w) => w.slug === slug)!;
      const weeks = await getWeeksAvailability(ws.id);
      return { slug, weeks };
    })
  );

  const [first, ...rest] = perWorkspace;
  const weeks = first.weeks
    .filter((w) => rest.every((r) => r.weeks.some((rw) => rw.weekStart === w.weekStart)))
    .map((w) => {
      const states = perWorkspace.map(({ weeks: ws }) => {
        const match = ws.find((x) => x.weekStart === w.weekStart)!;
        return match.tiers.find((t) => t.tier === "standard");
      });
      const sold = states.some((s) => !s || s.state === "sold");
      const oneLeft = !sold && states.some((s) => s.state === "one_left");
      return {
        weekStart: w.weekStart,
        label: formatWeekRange(w.weekStart),
        tiers: [
          {
            tier: "standard" as const,
            state: sold ? ("sold" as const) : oneLeft ? ("one_left" as const) : ("available" as const),
            taken: Math.max(...states.map((s) => s?.taken ?? 0)),
            slots: 2,
          },
        ],
      };
    });

  const standaloneTotalCents = CAMPAIGN_BUNDLE_SLUGS.reduce((sum, slug) => sum + campaignPriceCents(slug), 0);
  return NextResponse.json({
    weeks,
    tiers: {
      standard: {
        priceCents: CAMPAIGN_BUNDLE_PRICE_CENTS,
        slots: 2,
        label: "7-Issue Featured Campaign (Both Cities)",
      },
    },
    bundle: { priceCents: CAMPAIGN_BUNDLE_PRICE_CENTS, standaloneTotalCents, slugs: [...CAMPAIGN_BUNDLE_SLUGS] },
  });
}
