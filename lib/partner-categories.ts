// Directory categories for Community Partner listings (SpotlightListing.category).
// Businesses pick their own category at signup or in the portal; the admin
// can correct it. The /partners page groups listings by this list, in this
// order. Listings with no category (or an unrecognized one) render in a
// trailing "More Community Partners" section, never hidden.
export const PARTNER_CATEGORIES = [
  { slug: "food-drink", label: "Food & Drink" },
  { slug: "shopping-retail", label: "Shopping & Retail" },
  { slug: "home-services", label: "Home Services" },
  { slug: "health-wellness", label: "Health & Wellness" },
  { slug: "entertainment-recreation", label: "Entertainment & Recreation" },
  { slug: "events-venues", label: "Events & Venues" },
  { slug: "professional-services", label: "Professional Services" },
  { slug: "farms-agriculture", label: "Farms & Agriculture" },
  { slug: "nonprofits-community", label: "Nonprofits & Community" },
  { slug: "government-civic", label: "Government & Civic" },
  { slug: "from-the-gist", label: "From The Gist" },
] as const;

export type PartnerCategorySlug = (typeof PARTNER_CATEGORIES)[number]["slug"];

export function isPartnerCategory(value: unknown): value is PartnerCategorySlug {
  return (
    typeof value === "string" &&
    PARTNER_CATEGORIES.some((c) => c.slug === value)
  );
}

export function partnerCategoryLabel(slug: string | null | undefined): string {
  return (
    PARTNER_CATEGORIES.find((c) => c.slug === slug)?.label ??
    "More Community Partners"
  );
}
