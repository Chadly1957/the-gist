import { isPartnerCategory } from "./partner-categories";

// Shared constants for the /local SEO section: directory category pages
// and evergreen stories live under one route. A category page becomes
// indexable once the workspace has enough public listings in it that the
// page is real content rather than a thin doorway; below the threshold it
// still renders (so internal links never break) but stays noindex and
// out of the sitemap, and it promotes itself automatically the moment
// the threshold is met.
export const LOCAL_CATEGORY_INDEX_MIN = 3;

// House listings never get a category page.
export const LOCAL_EXCLUDED_CATEGORY = "from-the-gist";

// Category slugs are reserved words under /local: a valid category slug
// (other than the excluded house one) always resolves as the category
// page, never as a story slug.
export function isLocalCategorySlug(slug: string): boolean {
  return slug !== LOCAL_EXCLUDED_CATEGORY && isPartnerCategory(slug);
}

// The Workspace row carries the city name in `area` ("Decatur"); every
// current workspace is an Illinois city, so the state half of the
// "<City>, <ST>" title format is fixed until a non-Illinois workspace
// exists.
export function workspaceCityState(area: string): string {
  return `${area}, IL`;
}

export type StorySection = "news" | "local";

export function isStorySection(value: unknown): value is StorySection {
  return value === "news" || value === "local";
}
