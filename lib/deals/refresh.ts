// Runs retailer fetchers and stores results as draft DealWeeks for review.
// Called from the admin "Refresh week" action (one click). Chad reviews,
// picks Top 10, then publishes.

import { basePrisma } from "@/lib/db-base";
import { fetchRetailerDeals } from "./fetchers";
import { PipelineType, StoreConfig } from "./types";

export interface RefreshOutcome {
  retailerSlug: string;
  displayName: string;
  ok: boolean;
  dealCount?: number;
  weekStart?: string;
  error?: string;
}

function parseConfig(raw: string): StoreConfig {
  try {
    return JSON.parse(raw || "{}") as StoreConfig;
  } catch {
    return {};
  }
}

export async function refreshRetailer(
  workspaceId: string,
  retailerId: string
): Promise<RefreshOutcome> {
  const retailer = await basePrisma.retailer.findFirst({ where: { id: retailerId, workspaceId } });
  if (!retailer) throw new Error("Retailer not found.");
  if (!retailer.active) throw new Error(`${retailer.displayName} is disabled.`);
  const pipeline = retailer.pipeline as PipelineType;
  if (pipeline === "manual") throw new Error(`${retailer.displayName} is manual — add deals by hand.`);

  const outcome: RefreshOutcome = {
    retailerSlug: retailer.slug,
    displayName: retailer.displayName,
    ok: false,
  };
  try {
    const result = await fetchRetailerDeals(pipeline, parseConfig(retailer.storeConfig));
    // Upsert the week's row; never clobber a published week's status.
    const existing = await basePrisma.dealWeek.findUnique({
      where: {
        workspaceId_retailerId_weekStart: {
          workspaceId,
          retailerId: retailer.id,
          weekStart: result.weekStart,
        },
      },
      select: { id: true, status: true },
    });
    const week =
      existing ||
      (await basePrisma.dealWeek.create({
        data: {
          workspaceId,
          retailerId: retailer.id,
          weekStart: result.weekStart,
          weekEnd: result.weekEnd,
          sourceUrl: result.sourceUrl,
          status: "draft",
        },
      }));

    // Replace the week's deals with the fresh fetch.
    await basePrisma.deal.deleteMany({ where: { workspaceId, dealWeekId: week.id } });
    let order = 0;
    for (const d of result.deals) {
      await basePrisma.deal.create({
        data: {
          workspaceId,
          dealWeekId: week.id,
          title: d.title,
          price: d.price,
          regPrice: d.regPrice,
          category: d.category,
          summary: d.summary || "",
          dealUrl: d.dealUrl,
          validFrom: d.validFrom,
          validTo: d.validTo,
          sortOrder: order++,
        },
      });
    }
    outcome.ok = true;
    outcome.dealCount = result.deals.length;
    outcome.weekStart = result.weekStart;
  } catch (err) {
    outcome.error = err instanceof Error ? err.message : String(err);
  }
  return outcome;
}

export async function refreshAllRetailers(workspaceId: string): Promise<RefreshOutcome[]> {
  const retailers = await basePrisma.retailer.findMany({
    where: { workspaceId, active: true, pipeline: { not: "manual" } },
    orderBy: { displayName: "asc" },
  });
  const outcomes: RefreshOutcome[] = [];
  for (const r of retailers) {
    outcomes.push(await refreshRetailer(workspaceId, r.id));
    // Small pause between retailers — polite, and avoids any rate-limit fuss.
    await new Promise((res) => setTimeout(res, 1000));
  }
  return outcomes;
}

/** Ensure a published manual DealWeek exists for the retailer's current week. */
export async function ensureManualWeek(
  workspaceId: string,
  retailerId: string,
  weekStart: string,
  weekEnd: string
) {
  const existing = await basePrisma.dealWeek.findUnique({
    where: { workspaceId_retailerId_weekStart: { workspaceId, retailerId, weekStart } },
  });
  if (existing) return existing;
  return basePrisma.dealWeek.create({
    data: {
      workspaceId,
      retailerId,
      weekStart,
      weekEnd,
      status: "published",
      publishedAt: new Date(),
    },
  });
}
