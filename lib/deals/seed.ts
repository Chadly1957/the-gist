// Idempotent retailer seeding for the coupon-book content engine.
// Run once per workspace from the admin deals page ("Seed retailers").

import { basePrisma } from "@/lib/db-base";
import { KIRBY_DEALS, KIRBY_WEEK_START, KIRBY_WEEK_END } from "./kirby-week-2026-10-07";
import { PipelineType, StoreConfig } from "./types";

interface RetailerSeed {
  slug: string;
  displayName: string;
  pipeline: PipelineType;
  storeConfig: StoreConfig;
  logoUrl?: string;
  notes?: string;
  // If set, only seed in these workspace slugs (e.g. local chains).
  onlyWorkspaces?: string[];
}

// Brand logos (Wikimedia Commons, verified hotlinkable SVGs).
const LOGOS: Record<string, string> = {
  "hobby-lobby": "https://upload.wikimedia.org/wikipedia/commons/4/4c/Hobby_Lobby_logo.svg",
  target: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Target_logo.svg",
  aldi: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Aldi_S%C3%BCd_Logo_%282006%29.svg",
  "dollar-general": "https://upload.wikimedia.org/wikipedia/commons/0/05/Dollar_General_logo.svg",
  kroger: "https://upload.wikimedia.org/wikipedia/commons/6/69/Kroger_logo_%281961-2019%29.svg",
};

const COMMON_MANUAL: RetailerSeed[] = [
  {
    slug: "business-deals",
    displayName: "Business Deals",
    pipeline: "manual",
    storeConfig: {},
    notes: "Evergreen input: any business Chad finds. No weekly obligation.",
  },
  {
    slug: "rebates",
    displayName: "Rebate Roundup",
    pipeline: "manual",
    storeConfig: {},
    notes: "Ibotta / Checkout51 top offers, curated by hand.",
  },
  {
    slug: "freebies",
    displayName: "Freebies & Samples",
    pipeline: "manual",
    storeConfig: {},
    notes: "Weekly free-stuff roundup.",
  },
  {
    slug: "gas",
    displayName: "Gas Prices",
    pipeline: "manual",
    storeConfig: {},
    notes: "Cheapest gas in town (manual until an API is wired).",
  },
];

const PER_MARKET: Record<string, { zip: string; targetStoreId: string; aldiStoreCode: string }> = {
  decatur: { zip: "62521", targetStoreId: "1951", aldiStoreCode: "468-048" },
  effingham: { zip: "62401", targetStoreId: "1951", aldiStoreCode: "441-071" },
};

// One-time v1: load the vision-extracted Kirby Foods IGA week (2026-10-07)
// as a draft DealWeek for review/publish. Idempotent per weekStart.
export async function seedKirbyWeek(workspaceId: string): Promise<{ created: boolean }> {
  const retailer = await basePrisma.retailer.findUnique({
    where: { workspaceId_slug: { workspaceId, slug: "kirby-foods" } },
  });
  if (!retailer) return { created: false };
  const existing = await basePrisma.dealWeek.findFirst({
    where: { workspaceId, retailerId: retailer.id, weekStart: KIRBY_WEEK_START },
  });
  if (existing) return { created: false };
  const week = await basePrisma.dealWeek.create({
    data: {
      workspaceId,
      retailerId: retailer.id,
      weekStart: KIRBY_WEEK_START,
      weekEnd: KIRBY_WEEK_END,
      sourceUrl: "https://www.kirbyfoods.com/weekly-ads/6/Kirby Foods Effingham",
      status: "draft",
    },
  });
  await basePrisma.deal.createMany({
    data: KIRBY_DEALS.map((d, i) => ({
      workspaceId,
      dealWeekId: week.id,
      title: d.title,
      price: d.price,
      category: d.category,
      summary: [d.size ? `${d.size}` : "", d.summary || ""].filter(Boolean).join(" ").trim(),
      dealUrl: "https://www.kirbyfoods.com/weekly-ads/6/Kirby Foods Effingham",
      validFrom: KIRBY_WEEK_START,
      validTo: KIRBY_WEEK_END,
      sortOrder: i,
    })),
  });
  return { created: true };
}

export async function seedRetailers(workspaceId: string): Promise<{ created: number; kept: number }> {
  // PER_MARKET is keyed by workspace slug ("decatur"/"effingham"), not the
  // database ID (Decatur's ID happens to be "decatur"; other workspaces use cuids).
  const ws = await basePrisma.workspace.findUnique({ where: { id: workspaceId }, select: { slug: true } });
  const market = PER_MARKET[ws?.slug || workspaceId] || { zip: "", targetStoreId: "1951", aldiStoreCode: "" };

  const seeds: RetailerSeed[] = [
    { slug: "hobby-lobby", displayName: "Hobby Lobby", pipeline: "hobby-lobby", storeConfig: {}, logoUrl: LOGOS["hobby-lobby"] },
    {
      slug: "target",
      displayName: "Target",
      pipeline: "target",
      // Effingham reuses Decatur's store: the circular is effectively identical;
      // the store ID is editable in retailer settings if that changes.
      storeConfig: { zip: market.zip, storeId: market.targetStoreId },
      logoUrl: LOGOS["target"],
    },
    {
      slug: "aldi",
      displayName: "Aldi",
      pipeline: "aldi",
      storeConfig: { zip: market.zip, storeCode: market.aldiStoreCode },
      logoUrl: LOGOS["aldi"],
    },
    {
      slug: "dollar-general",
      displayName: "Dollar General",
      pipeline: "dollar-general",
      storeConfig: { zip: market.zip, merchant: "dollargeneral" },
      logoUrl: LOGOS["dollar-general"],
      notes: "Needs one-time flyerkit token paste (see retailer settings).",
    },
    {
      slug: "kroger",
      displayName: "Kroger",
      pipeline: "kroger",
      storeConfig: { zip: market.zip },
      logoUrl: LOGOS["kroger"],
      notes: "Needs free API key at developer.kroger.com (KROGER_CLIENT_ID/SECRET).",
    },
    {
      slug: "kirby-foods",
      displayName: "Kirby Foods IGA",
      pipeline: "manual",
      storeConfig: { adPageUrl: "https://www.kirbyfoods.com/weekly-ads/6/Kirby Foods Effingham" },
      notes: "Local IGA chain (Effingham store). Weekly ad is S3 images; deals vision-extracted weekly.",
      onlyWorkspaces: ["effingham"],
    },
    ...COMMON_MANUAL,
  ];

  const slug = ws?.slug || workspaceId;
  let created = 0;
  let kept = 0;
  for (const s of seeds) {
    if (s.onlyWorkspaces && !s.onlyWorkspaces.includes(slug)) continue;
    const existing = await basePrisma.retailer.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: s.slug } },
    });
    if (existing) {
      if (s.logoUrl && !existing.logoUrl) {
        await basePrisma.retailer.update({
          where: { id: existing.id },
          data: { logoUrl: s.logoUrl },
        });
      }
      // Backfill market config (zip/storeCode/storeId) when the existing row
      // was seeded without it (e.g. seeded before the slug lookup was fixed).
      // Never overwrites a value Chad set by hand.
      try {
        const cfg = JSON.parse(existing.storeConfig || "{}");
        const seedCfg = s.storeConfig as Record<string, string>;
        let patched = false;
        for (const k of ["zip", "storeCode", "storeId"]) {
          if (!cfg[k] && seedCfg[k]) { cfg[k] = seedCfg[k]; patched = true; }
        }
        if (patched) {
          await basePrisma.retailer.update({
            where: { id: existing.id },
            data: { storeConfig: JSON.stringify(cfg) },
          });
        }
      } catch { /* leave a hand-edited config alone if it isn't JSON */ }
      kept++;
      continue;
    }
    await basePrisma.retailer.create({
      data: {
        workspaceId,
        slug: s.slug,
        displayName: s.displayName,
        pipeline: s.pipeline,
        storeConfig: JSON.stringify(s.storeConfig),
        logoUrl: s.logoUrl || null,
        active: true,
      },
    });
    created++;
  }
  if (slug === "effingham") await seedKirbyWeek(workspaceId);
  return { created, kept };
}
