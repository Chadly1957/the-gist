// Decatur, IL area location keywords — used for tagging scraped articles
export const LOCATION_KEYWORDS = [
  "decatur",
  "macon county",
  "macon",
  "central illinois",
  "millikin",
  "caterpillar",
  "archer daniels midland",
  "adm",
  "staley",
  "tate & lyle",
  "springfield",
  "sangamon",
  "champaign",
  "bloomington",
  "normal",
  "forsyth",
  "mount zion",
  "mt. zion",
  "lincoln square",
  "illinois",
];

// Generic category-page or section-page titles that are never real articles
const FLUFF_TITLES = new Set([
  "local news",
  "news",
  "sports",
  "business",
  "opinion",
  "politics",
  "entertainment",
  "health",
  "science",
  "technology",
  "breaking news",
  "top stories",
  "latest news",
  "featured",
  "national news",
  "world news",
  "state news",
  "weather",
  "traffic",
  "crime",
  "real estate",
  "community",
  "lifestyle",
  "arts & culture",
  "arts",
  "food",
  "education",
  "public safety",
  "government",
  "obituaries",
  "classifieds",
]);

/** Returns matched location tags from title + description text */
export function detectLocationTags(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  return LOCATION_KEYWORDS.filter((kw) => text.includes(kw));
}

/** Returns true if the article should be discarded as a fluff/category page */
export function isFluffArticle(title: string, description: string): boolean {
  const t = title.trim().toLowerCase();
  if (t.length < 8) return true;
  if (FLUFF_TITLES.has(t)) return true;
  if (!description || description.trim().length < 25) return true;
  return false;
}

/**
 * Returns true if the article passes the source's keyword requirement.
 * keywords is comma-separated; empty string means no filter (accept all).
 */
export function passesSourceFilter(title: string, description: string, keywords: string): boolean {
  const kws = keywords
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (kws.length === 0) return true;
  const text = `${title} ${description}`.toLowerCase();
  return kws.some((kw) => text.includes(kw));
}
