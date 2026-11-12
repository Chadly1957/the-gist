import { prisma } from "./db";
import { PARTNER_CATEGORIES } from "./partner-categories";
import { LOCAL_CATEGORY_INDEX_MIN, isLocalCategorySlug } from "./local-seo";

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
      // The listing is the placement row; the business copy comes from
      // the profile (single source of truth, unified 2026-11-12). The
      // listing columns are legacy snapshots kept as a fallback.
      sponsor: {
        select: { businessName: true, logoUrl: true, description: true, website: true, category: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Read the business fields off the profile, falling back to the
  // listing snapshot where the profile field is still empty. The
  // sponsor relation is stripped back out so the returned rows keep
  // exactly the shape callers already expect.
  const mapped = rows.map(({ sponsor, ...r }) => ({
    ...r,
    businessName: sponsor.businessName,
    logoUrl: sponsor.logoUrl ?? r.logoUrl,
    description: sponsor.description ?? r.description,
    ctaUrl: sponsor.website ?? r.ctaUrl,
    category: sponsor.category ?? r.category,
  }));

  const seen = new Set<string>();
  const partners = mapped.filter((r) => {
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

// The indexable slice of the directory: the categories whose public
// listing count has earned a /local page. The count is taken from the
// very items array the category page renders, and the /local hub lists
// exactly this summary, so a hub count can never drift from the number
// of cards on the page it links to.
export function indexableDirectoryCategories(
  byCategory: Map<string, PartnerListing[]>
): Array<{ slug: string; label: string; count: number; items: PartnerListing[] }> {
  return PARTNER_CATEGORIES.filter(
    (c) =>
      isLocalCategorySlug(c.slug) &&
      (byCategory.get(c.slug)?.length ?? 0) >= LOCAL_CATEGORY_INDEX_MIN
  ).map((c) => {
    const items = byCategory.get(c.slug) ?? [];
    return { slug: c.slug, label: c.label, count: items.length, items };
  });
}
