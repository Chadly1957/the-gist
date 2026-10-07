// Coupon book content engine — shared deal types.
// All fetchers are server-side only (Node fetch + cheerio), logged-out,
// once per week per retailer. Text-only output: prices/facts are restated in
// our own words, every deal deep-links to the retailer's own ad page.

export interface NormalizedDeal {
  /** Our own wording — short factual title, no copied ad headlines. */
  title: string;
  /** Display price string as the retailer shows it, e.g. "$3.99", "40% off". */
  price?: string;
  regPrice?: string;
  category?: string;
  summary?: string;
  /** Deep link to the retailer's own ad/offer page. */
  dealUrl?: string;
  /** True when dealUrl lands on the specific item rather than the weekly ad. */
  isItemUrl?: boolean;
  /** Manual/evergreen deals only. */
  businessName?: string;
  validFrom?: string;
  validTo?: string;
}

export interface StoreConfig {
  zip?: string;
  /** Target: numeric store id, e.g. "1951" (Decatur IL). */
  storeId?: string;
  /** Flipp flyerkit merchant store code, e.g. Aldi "468-048". */
  storeCode?: string;
  /** Flipp flyerkit access token (per-retailer, extracted once). */
  token?: string;
  /** Flipp flyerkit merchant slug, e.g. "aldi". */
  merchant?: string;
  /** Kroger: location id from the official API. */
  locationId?: string;
}

export interface FetchResult {
  deals: NormalizedDeal[];
  /** YYYY-MM-DD (Monday) */
  weekStart: string;
  /** YYYY-MM-DD */
  weekEnd: string;
  sourceUrl: string;
}

export type PipelineType =
  | "hobby-lobby"
  | "target"
  | "aldi"
  | "dollar-general"
  | "kroger"
  | "manual";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function politeGet(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(init?.headers || {}),
    },
    // Never send cookies / credentials — logged-out fetching only.
    credentials: "omit",
  });
  return res;
}

/** Clean a retailer headline into our own short factual wording. */
export function cleanTitle(raw: string): string {
  return raw
    .replace(/[™®©¬­]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*$/, "")
    .trim()
    .slice(0, 200);
}
