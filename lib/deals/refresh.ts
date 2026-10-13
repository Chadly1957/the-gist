// Runs retailer fetchers and stores results as LIVE (published) DealWeeks.
// Full automation (Chad's call, 2026-10-12): as long as a fetch returns
// deals for the retailer's configured market, they go straight into the
// book — no draft review step. Location matching is inherent: every
// retailer is seeded with a storeConfig (zip / storeId / locationId) tied
// to its workspace's market, and refreshers never touch another workspace.
// Safety valve: a week with zero fetched deals stays a draft so an empty or
// glitched fetch can never blank out a retailer's live section.

import { basePrisma } from "@/lib/db-base";
import { fetchRetailerDeals } from "./fetchers";
import { PipelineType, StoreConfig } from "./types";

export interface RefreshOutcome {
  retailerSlug: string;
  displayName: string;
  ok: boolean;
  dealCount?: number;
  weekStart?: string;
  note?: string;
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
    const hasDeals = result.deals.length > 0;
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
          // Auto-publish on creation when the fetch returned real deals;
          // zero-deal weeks stay drafts (safety valve, see header).
          ...(hasDeals
            ? { status: "published", publishedAt: new Date() }
            : { status: "draft" }),
        },
      }));

    // Auto-publish: a refreshed week with deals goes live immediately.
    // Existing published weeks keep their status; zero-deal weeks stay
    // drafts so a glitched fetch can never blank the book.
    if (hasDeals && week.status !== "published") {
      await basePrisma.dealWeek.update({
        where: { id: week.id },
        data: { status: "published", publishedAt: new Date() },
      });
    }

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
          isItemUrl: d.isItemUrl ?? false,
          validFrom: d.validFrom,
          validTo: d.validTo,
          sortOrder: order++,
        },
      });
    }
    outcome.ok = true;
    outcome.dealCount = result.deals.length;
    outcome.weekStart = result.weekStart;
    if (!hasDeals) outcome.note = "0 deals fetched — week left as draft, not published.";
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
