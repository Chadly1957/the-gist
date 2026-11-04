import { prisma } from "./db";
import { PARTNER_CATEGORIES } from "./partner-categories";

// The public Community Partner directory set for this workspace, shared
// by /partners, the /local category pages + hub, and the sitemap so all
// of them always agree on who is listed and how many fall in each
// category. Same rules as the /partners page has always used: live
// (approved/active) listings only, one card per business (newest row
// wins), alphabetical.
export async function getPartnerDirectory() {
  const rows = await prisma.spotlightListing.findMany({
    where: { status: { in: ["approved", "active"] } },
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      description: true,
      ctaLabel: true,
      ctaUrl: true,
      category: true,
      createdAt: true,
      approvedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const seen = new Set<string>();
  const partners = rows.filter((r) => {
    const key = r.businessName.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  partners.sort((a, b) => a.businessName.localeCompare(b.businessName));

  const byCategory = new Map<string, typeof partners>();
  for (const cat of PARTNER_CATEGORIES) {
    const items = partners.filter((p) => p.category === cat.slug);
    if (items.length > 0) byCategory.set(cat.slug, items);
  }

  return { partners, byCategory };
}

export type PartnerDirectory = Awaited<ReturnType<typeof getPartnerDirectory>>;
export type PartnerListing = PartnerDirectory["partners"][number];
