// Idempotent retailer seeding for the coupon-book content engine.
// Run once per workspace from the admin deals page ("Seed retailers").

import { basePrisma } from "@/lib/db-base";
import { PipelineType, StoreConfig } from "./types";

interface RetailerSeed {
  slug: string;
  displayName: string;
  pipeline: PipelineType;
  storeConfig: StoreConfig;
  notes?: string;
}

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

export async function seedRetailers(workspaceId: string): Promise<{ created: number; kept: number }> {
  const market = PER_MARKET[workspaceId] || { zip: "", targetStoreId: "1951", aldiStoreCode: "" };

  const seeds: RetailerSeed[] = [
    { slug: "hobby-lobby", displayName: "Hobby Lobby", pipeline: "hobby-lobby", storeConfig: {} },
    {
      slug: "target",
      displayName: "Target",
      pipeline: "target",
      // Effingham reuses Decatur's store: the circular is effectively identical;
      // the store ID is editable in retailer settings if that changes.
      storeConfig: { zip: market.zip, storeId: market.targetStoreId },
    },
    {
      slug: "aldi",
      displayName: "Aldi",
      pipeline: "aldi",
      storeConfig: { zip: market.zip, storeCode: market.aldiStoreCode },
    },
    {
      slug: "dollar-general",
      displayName: "Dollar General",
      pipeline: "dollar-general",
      storeConfig: { zip: market.zip, merchant: "dollargeneral" },
      notes: "Needs one-time flyerkit token paste (see retailer settings).",
    },
    {
      slug: "kroger",
      displayName: "Kroger",
      pipeline: "kroger",
      storeConfig: { zip: market.zip },
      notes: "Needs free API key at developer.kroger.com (KROGER_CLIENT_ID/SECRET).",
    },
    ...COMMON_MANUAL,
  ];

  let created = 0;
  let kept = 0;
  for (const s of seeds) {
    const existing = await basePrisma.retailer.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: s.slug } },
    });
    if (existing) {
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
        active: true,
      },
    });
    created++;
  }
  return { created, kept };
}
