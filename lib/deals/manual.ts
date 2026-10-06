// Manual/evergreen deal input — the generic business-deal path.
// Used by: the admin UI form, the admin API routes (POST/PUT/DELETE), and any
// programmatic caller (e.g. a side-chat agent filing deals on Chad's behalf).
// Same workspace scoping and validation everywhere.

import { basePrisma } from "@/lib/db-base";
import { validateManualDeal, ManualDealInput } from "./validate";
import { ensureManualWeek } from "./refresh";
import { mondayOfWeek, sundayOfWeek } from "./week";

export async function createManualDeal(workspaceId: string, input: ManualDealInput) {
  const v = validateManualDeal(input);
  const retailer = await basePrisma.retailer.findFirst({
    where: { workspaceId, slug: v.retailerSlug, active: true },
  });
  if (!retailer) throw new Error(`Retailer "${v.retailerSlug}" not found in this workspace.`);
  if (retailer.pipeline !== "manual") {
    throw new Error(`"${retailer.displayName}" is an automated pipeline — manual deals go in a manual bucket.`);
  }

  // Manual deals go live immediately: Chad is the curator, no review queue.
  const week = await ensureManualWeek(workspaceId, retailer.id, mondayOfWeek(), sundayOfWeek());
  const maxOrder = await basePrisma.deal.aggregate({
    where: { workspaceId, dealWeekId: week.id },
    _max: { sortOrder: true },
  });
  return basePrisma.deal.create({
    data: {
      workspaceId,
      dealWeekId: week.id,
      businessName: v.businessName,
      title: v.title,
      price: v.price,
      regPrice: v.regPrice,
      category: v.category,
      summary: v.summary || "",
      dealUrl: v.dealUrl,
      validFrom: v.validFrom,
      validTo: v.validTo,
      isTopPick: v.isTopPick,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
}

export async function updateManualDeal(
  workspaceId: string,
  dealId: string,
  input: ManualDealInput
) {
  const existing = await basePrisma.deal.findFirst({
    where: { id: dealId, workspaceId },
    include: { dealWeek: { include: { retailer: true } } },
  });
  if (!existing) throw new Error("Deal not found.");
  if (existing.dealWeek.retailer.pipeline !== "manual") {
    throw new Error("Only manual-pipeline deals can be edited here.");
  }
  const v = validateManualDeal({ ...input, retailerSlug: existing.dealWeek.retailer.slug });
  return basePrisma.deal.update({
    where: { id: dealId },
    data: {
      businessName: v.businessName,
      title: v.title,
      price: v.price,
      regPrice: v.regPrice,
      category: v.category,
      summary: v.summary || "",
      dealUrl: v.dealUrl,
      validFrom: v.validFrom,
      validTo: v.validTo,
      isTopPick: v.isTopPick,
      sortOrder: v.sortOrder,
    },
  });
}

export async function deleteManualDeal(workspaceId: string, dealId: string) {
  const existing = await basePrisma.deal.findFirst({
    where: { id: dealId, workspaceId },
    include: { dealWeek: { include: { retailer: true } } },
  });
  if (!existing) throw new Error("Deal not found.");
  if (existing.dealWeek.retailer.pipeline !== "manual") {
    throw new Error("Only manual-pipeline deals can be deleted here.");
  }
  await basePrisma.deal.delete({ where: { id: dealId } });
  return { deleted: true };
}
