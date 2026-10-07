import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Distinct business names Chad has used, for the manual-deal autocomplete.
// hasPortal = the business has a sponsor portal (SponsorProfile).
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();

  const [coupons, deals, sponsors, sponsorRetailers] = await Promise.all([
    prisma.coupon.findMany({
      where: { workspaceId: workspace.id, businessName: { not: "" } },
      select: { businessName: true },
      distinct: ["businessName"],
    }),
    prisma.deal.findMany({
      where: { workspaceId: workspace.id, businessName: { not: null } },
      select: { businessName: true },
      distinct: ["businessName"],
    }),
    prisma.sponsorProfile.findMany({
      where: { workspaceId: workspace.id },
      select: { businessName: true },
    }),
    prisma.retailer.findMany({
      where: { workspaceId: workspace.id, sponsorId: { not: null } },
      select: { displayName: true },
    }),
  ]);

  const portalNames = new Set(
    sponsors.map((s) => s.businessName.trim().toLowerCase()).filter(Boolean)
  );
  const byKey = new Map<string, { name: string; hasPortal: boolean }>();
  const add = (raw: string | null) => {
    const name = raw?.trim() || "";
    if (!name) return;
    const key = name.toLowerCase();
    const hasPortal = portalNames.has(key);
    const prev = byKey.get(key);
    if (!prev || (hasPortal && !prev.hasPortal)) byKey.set(key, { name, hasPortal });
  };
  coupons.forEach((c) => add(c.businessName));
  deals.forEach((d) => add(d.businessName));
  sponsors.forEach((s) => add(s.businessName));
  sponsorRetailers.forEach((r) => add(r.displayName));

  const businesses = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ businesses });
}
