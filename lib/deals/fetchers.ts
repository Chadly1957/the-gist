// Coupon book content engine — retailer fetchers (Phase 1).
//
// Server-side only. Every fetcher is: logged-out, no cookies, no accounts,
// no CAPTCHA/bot-wall circumvention, at most once per week per retailer.
// Output is text-only and restated in our own words; every deal carries a
// deep link to the retailer's own page.
//
// Walmart is intentionally NOT here: walmart.com's weekly ad sits behind a
// PerimeterX bot wall. Manual entry covers it (see the admin deals UI).

import * as cheerio from "cheerio";
import {
  NormalizedDeal,
  StoreConfig,
  FetchResult,
  PipelineType,
  politeGet,
  cleanTitle,
} from "./types";
import { mondayOfWeek, sundayOfWeek, normalizeDate } from "./week";

// ---------------------------------------------------------------------------
// Hobby Lobby — static server-rendered HTML, national ad, no store needed.
// https://www.hobbylobby.com/weekly-ad
// ---------------------------------------------------------------------------
export async function fetchHobbyLobby(): Promise<FetchResult> {
  const sourceUrl = "https://www.hobbylobby.com/weekly-ad";
  const res = await politeGet(sourceUrl);
  if (!res.ok) throw new Error(`Hobby Lobby fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Ad validity, e.g. "Valid through October 10, 2026"
  const headerText = $('[class*="weeklyAd_header"]').text();
  const validMatch = headerText.match(/Valid through\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  let weekEnd = sundayOfWeek();
  if (validMatch) {
    const parsed = new Date(validMatch[1].replace(",", ""));
    if (!isNaN(parsed.getTime())) {
      weekEnd = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
        parsed.getDate()
      ).padStart(2, "0")}`;
    }
  }

  const deals: NormalizedDeal[] = [];
  const seen = new Set<string>();
  $('div[class*="weeklyAd_weeklyAdBox__"]').each((_, el) => {
    const box = $(el);
    const title = cleanTitle(box.find('h2[class*="weeklyAd_title"]').first().text());
    if (!title || seen.has(title.toLowerCase())) return;
    seen.add(title.toLowerCase());
    const discount = box
      .find('h3[class*="weeklyAd_discount"]')
      .first()
      .text()
      .replace(/(\d)\s*%\s*off/i, "$1% off")
      .replace(/\s+/g, " ")
      .trim();
    const details = box
      .find('div[class*="weeklyAd_details"]')
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    const href = box.find('a[class*="weeklyAd_wrapper"]').first().attr("href");
    const dealUrl = href ? `https://www.hobbylobby.com${href}` : sourceUrl;
    deals.push({
      title: discount ? `${title} — ${discount}` : title,
      price: discount || undefined,
      category: "Crafts & Home",
      summary: details || undefined,
      dealUrl,
      isItemUrl: !!href,
    });
  });

  if (!deals.length) throw new Error("Hobby Lobby: no deal boxes parsed (markup may have changed)");
  return { deals, weekStart: mondayOfWeek(), weekEnd, sourceUrl };
}

// ---------------------------------------------------------------------------
// Target — reverse-engineered JSON API (api.target.com/weekly_ads).
// Store-scoped via storeConfig.storeId (e.g. "1951" = Decatur IL).
// ---------------------------------------------------------------------------
const TARGET_KNOWN_KEY = "9ba599525edd204c560a2182ae1cbfaa3eeddca5";

async function getTargetApiKey(): Promise<string> {
  try {
    const res = await politeGet("https://www.target.com/weekly-ad");
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/WEEKLYAD_API_KEY\\+":\\"([a-f0-9]{32})/);
      if (m) return m[1];
    }
  } catch {
    // fall through to known key
  }
  return TARGET_KNOWN_KEY;
}

const TARGET_JUNK_TITLE = /^(deals for members|the membership that unlocks|join for free|members get)/i;

export async function fetchTarget(config: StoreConfig): Promise<FetchResult> {
  const storeId = config.storeId?.trim();
  if (!storeId) {
    throw new Error(
      'Target: no storeId configured. Set the store ID in the retailer settings (e.g. "1951" for Decatur IL).'
    );
  }
  const key = await getTargetApiKey();
  const sourceUrl = "https://www.target.com/weekly-ad";

  const promosRes = await politeGet(
    `https://api.target.com/weekly_ads/v1/store_promotions?key=${key}&store_id=${encodeURIComponent(storeId)}`
  );
  if (promosRes.status === 403) {
    throw new Error("Target: API key rejected (403) — the embedded key may have rotated; retry to re-extract it.");
  }
  if (!promosRes.ok) throw new Error(`Target promotions failed: HTTP ${promosRes.status}`);
  const promos = (await promosRes.json()) as Array<{
    promotion_id: string;
    sale_start_date?: string;
    sale_end_date?: string;
    sneak_peek?: boolean;
  }>;
  const promo = promos.find((p) => !p.sneak_peek) || promos[0];
  if (!promo) throw new Error(`Target: no active promotion for store ${storeId}`);

  const dealsRes = await politeGet(
    `https://api.target.com/weekly_ads/v1/promotions/${encodeURIComponent(promo.promotion_id)}?key=${key}`
  );
  if (!dealsRes.ok) throw new Error(`Target promotion fetch failed: HTTP ${dealsRes.status}`);
  const data = (await dealsRes.json()) as {
    pages?: Array<{
      deals_category_name?: string;
      hotspots?: Array<{
        title?: string;
        price?: string;
        reg_price?: string;
        tcin?: string;
        circle_offer?: boolean;
        promotion_message?: string;
      }>;
    }>;
  };

  const deals: NormalizedDeal[] = [];
  const seen = new Set<string>();
  for (const page of data.pages || []) {
    const category = page.deals_category_name?.trim() || undefined;
    for (const h of page.hotspots || []) {
      const title = cleanTitle(h.title || "");
      if (!title || title.length < 4 || TARGET_JUNK_TITLE.test(title)) continue;
      const dedupe = `${title}|${h.price || ""}`.toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const summaryParts: string[] = [];
      if (h.circle_offer) summaryParts.push("Target Circle offer — clip it in the Target app before you go.");
      if (h.promotion_message && !/circle/i.test(h.promotion_message))
        summaryParts.push(h.promotion_message.trim());
      deals.push({
        title,
        price: h.price?.trim() || undefined,
        regPrice: h.reg_price?.trim() || undefined,
        category,
        summary: summaryParts.join(" ") || undefined,
        dealUrl: h.tcin ? `https://www.target.com/p/-/A-${h.tcin}` : sourceUrl,
        isItemUrl: !!h.tcin,
      });
    }
  }

  if (!deals.length) throw new Error("Target: no deals parsed (API shape may have changed)");
  return {
    deals,
    weekStart: normalizeDate(promo.sale_start_date) || mondayOfWeek(),
    weekEnd: normalizeDate(promo.sale_end_date) || sundayOfWeek(),
    sourceUrl,
  };
}

// ---------------------------------------------------------------------------
// Aldi + Dollar General — Flipp flyerkit backend.
// Aldi: token is embedded (public, same as open-source scrapers use);
//   store code resolved from ZIP via flyerkit store locator.
// Dollar General: token must be pasted once in retailer settings
//   (extracted from DG's weekly-ads page JS); same flow otherwise.
// ---------------------------------------------------------------------------
const ALDI_FLIPP_TOKEN = "29d9bfdcf546dc601c10c64ed1e932f5";
const FLYERKIT = "https://dam.flippenterprise.net/flyerkit";

interface FlyerkitStore {
  merchant_store_code?: string;
  store_code?: string;
  name?: string;
}

async function flyerkitStoreCode(opts: {
  merchant: string;
  token: string;
  zip: string;
}): Promise<string> {
  const url =
    `${FLYERKIT}/stores/${opts.merchant}?access_token=${encodeURIComponent(opts.token)}` +
    `&postal_code=${encodeURIComponent(opts.zip)}`;
  const res = await politeGet(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Flipp store lookup failed for ${opts.merchant}: HTTP ${res.status}`);
  const stores = (await res.json()) as FlyerkitStore[] | { stores?: FlyerkitStore[] };
  const list = Array.isArray(stores) ? stores : stores.stores || [];
  const first = list[0];
  const code = first?.merchant_store_code || first?.store_code;
  if (!code) throw new Error(`Flipp: no stores found for ${opts.merchant} near ${opts.zip}`);
  return code;
}

async function fetchFlyerkitDeals(opts: {
  merchant: string;
  token: string;
  storeCode: string;
  sourceUrl: string;
  displayName: string;
}): Promise<FetchResult> {
  const pubsUrl =
    `${FLYERKIT}/publications/${opts.merchant}?store_code=${encodeURIComponent(opts.storeCode)}` +
    `&languages[]=en&locale=en&access_token=${encodeURIComponent(opts.token)}`;
  const pubsRes = await politeGet(pubsUrl, { headers: { Accept: "application/json" } });
  if (!pubsRes.ok) throw new Error(`Flipp publications failed for ${opts.merchant}: HTTP ${pubsRes.status}`);
  const pubsJson = (await pubsRes.json()) as
    | Array<{ id: number; name?: string; type?: string; valid_from?: string; valid_to?: string }>
    | { publications?: Array<{ id: number; name?: string; type?: string; valid_from?: string; valid_to?: string }> };
  const pubs = Array.isArray(pubsJson) ? pubsJson : pubsJson.publications || [];

  const today = new Date().toISOString().slice(0, 10);
  const current =
    pubs.find((p) => p.type === "weeklyad" && (!p.valid_from || p.valid_from.slice(0, 10) <= today) && (!p.valid_to || p.valid_to.slice(0, 10) >= today)) ||
    pubs.find((p) => !p.valid_from || p.valid_from.slice(0, 10) <= today) ||
    pubs[0];
  if (!current) throw new Error(`Flipp: no publications for ${opts.merchant}`);

  const prodsRes = await politeGet(
    `${FLYERKIT}/publication/${current.id}/products?display_type=all&locale=en&access_token=${encodeURIComponent(opts.token)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!prodsRes.ok) throw new Error(`Flipp products failed for ${opts.merchant}: HTTP ${prodsRes.status}`);
  const prodsJson = (await prodsRes.json()) as
    | Array<{
        id: number;
        name?: string;
        description?: string;
        price_text?: string;
        pre_price_text?: string;
        post_price_text?: string;
        sale_story?: string;
        original_price?: string;
        categories?: string[];
        valid_from?: string;
        valid_to?: string;
        item_type?: number;
      }>
    | { products?: Array<any> };
  const items = Array.isArray(prodsJson) ? prodsJson : (prodsJson as { products?: Array<any> }).products || [];

  const deals: NormalizedDeal[] = [];
  for (const it of items) {
    if (it.item_type === 5) continue; // flyer page/header, not a product
    const name = cleanTitle(it.name || "");
    if (!name) continue;
    const priceBits = [it.pre_price_text, it.price_text ? `$${it.price_text}` : "", it.post_price_text]
      .filter(Boolean)
      .join(" ")
      .trim();
    const summaryBits = [it.description, it.sale_story].filter(Boolean).join(" — ");
    deals.push({
      title: name,
      price: priceBits || undefined,
      regPrice: it.original_price ? `$${it.original_price}` : undefined,
      category: it.categories?.[0],
      summary: summaryBits || undefined,
      validFrom: normalizeDate(it.valid_from),
      validTo: normalizeDate(it.valid_to),
      dealUrl: opts.sourceUrl,
    });
  }
  if (!deals.length) throw new Error(`Flipp: no products parsed for ${opts.merchant}`);

  return {
    deals,
    weekStart: normalizeDate(current.valid_from) || mondayOfWeek(),
    weekEnd: normalizeDate(current.valid_to) || sundayOfWeek(),
    sourceUrl: opts.sourceUrl,
  };
}

export async function fetchAldi(config: StoreConfig): Promise<FetchResult> {
  const token = config.token || ALDI_FLIPP_TOKEN;
  const zip = config.zip;
  if (!zip) throw new Error("Aldi: no ZIP configured in retailer settings.");
  const storeCode = config.storeCode || (await flyerkitStoreCode({ merchant: "aldi", token, zip }));
  return fetchFlyerkitDeals({
    merchant: "aldi",
    token,
    storeCode,
    sourceUrl: "https://www.aldi.us/en/weekly-specials/",
    displayName: "Aldi",
  });
}

export async function fetchDollarGeneral(config: StoreConfig): Promise<FetchResult> {
  const token = config.token?.trim();
  if (!token) {
    throw new Error(
      "Dollar General: no flyerkit token configured. Paste it once in the retailer settings " +
        "(from DG's weekly-ads page: DevTools → Network → filter 'flyerkit' → copy access_token)."
    );
  }
  const merchant = config.merchant || "dollargeneral";
  const zip = config.zip;
  if (!zip) throw new Error("Dollar General: no ZIP configured in retailer settings.");
  const storeCode = config.storeCode || (await flyerkitStoreCode({ merchant, token, zip }));
  return fetchFlyerkitDeals({
    merchant,
    token,
    storeCode,
    sourceUrl: "https://www.dollargeneral.com/deals/weekly-ads",
    displayName: "Dollar General",
  });
}

// ---------------------------------------------------------------------------
// Kroger — official developer API (developer.kroger.com, free OAuth2 key).
// This is a PRICE API, not an ad feed: it powers per-store price checks on a
// curated staple list. Needs KROGER_CLIENT_ID / KROGER_CLIENT_SECRET env vars.
// Per Kroger's terms, API data is for internal use — we republish our own
// short price-check lines ("Kroger: whole milk $X") with a link to kroger.com.
// ---------------------------------------------------------------------------
const KROGER_STAPLES = [
  "whole milk gallon",
  "large eggs dozen",
  "white bread loaf",
  "bananas",
  "ground beef 80/20 per lb",
  "boneless chicken breast per lb",
  "cheddar cheese block",
  "butter quarters",
  "orange juice 52oz",
  "potato chips family size",
  "toilet paper 12 pack",
  "laundry detergent",
];

let krogerTokenCache: { token: string; exp: number } | null = null;

async function krogerToken(): Promise<string> {
  const id = process.env.KROGER_CLIENT_ID;
  const secret = process.env.KROGER_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Kroger: API not configured. Get a free key at developer.kroger.com and set KROGER_CLIENT_ID / KROGER_CLIENT_SECRET."
    );
  }
  if (krogerTokenCache && krogerTokenCache.exp > Date.now() + 60_000) return krogerTokenCache.token;
  const res = await fetch("https://api.kroger.com/v1/connect/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });
  if (!res.ok) throw new Error(`Kroger OAuth failed: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  krogerTokenCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function krogerLocationId(token: string, zip: string): Promise<string> {
  const res = await fetch(
    `https://api.kroger.com/v1/locations?filter.zipCode.near=${encodeURIComponent(zip)}&filter.limit=5`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Kroger locations failed: HTTP ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ locationId: string; name?: string }> };
  const loc = data.data?.[0];
  if (!loc) throw new Error(`Kroger: no stores near ${zip}`);
  return loc.locationId;
}

export async function fetchKroger(config: StoreConfig): Promise<FetchResult> {
  const zip = config.zip;
  if (!zip) throw new Error("Kroger: no ZIP configured in retailer settings.");
  const token = await krogerToken();
  const locationId = config.locationId || (await krogerLocationId(token, zip));
  const sourceUrl = "https://www.kroger.com/weeklyad";

  const deals: NormalizedDeal[] = [];
  for (const staple of KROGER_STAPLES) {
    const res = await fetch(
      `https://api.kroger.com/v1/products?filter.term=${encodeURIComponent(staple)}` +
        `&filter.locationId=${encodeURIComponent(locationId)}&filter.limit=3`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    if (!res.ok) continue;
    const data = (await res.json()) as {
      data?: Array<{
        description?: string;
        items?: Array<{ price?: { regular?: number; promo?: number } }>;
      }>;
    };
    const first = data.data?.[0];
    const price = first?.items?.[0]?.price;
    const amount = price?.promo ?? price?.regular;
    if (!first?.description || amount == null) continue;
    const itemQuery = cleanTitle(first.description || staple);
    deals.push({
      title: `Kroger price check: ${itemQuery}`,
      price: `$${amount.toFixed(2)}`,
      category: "Price check",
      summary: price?.promo != null ? "Sale price this week." : "Regular shelf price.",
      dealUrl: `https://www.kroger.com/search?query=${encodeURIComponent(itemQuery)}`,
      isItemUrl: false,
    });
    // Be gentle: the free tier allows 10k product calls/day; we use ~12/week.
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!deals.length) throw new Error("Kroger: no prices returned (API shape may have changed)");
  return { deals, weekStart: mondayOfWeek(), weekEnd: sundayOfWeek(), sourceUrl };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
export async function fetchRetailerDeals(
  pipeline: PipelineType,
  config: StoreConfig
): Promise<FetchResult> {
  switch (pipeline) {
    case "hobby-lobby":
      return fetchHobbyLobby();
    case "target":
      return fetchTarget(config);
    case "aldi":
      return fetchAldi(config);
    case "dollar-general":
      return fetchDollarGeneral(config);
    case "kroger":
      return fetchKroger(config);
    case "manual":
      throw new Error("Manual pipelines have no fetcher — add deals by hand in the admin UI.");
    default:
      throw new Error(`Unknown pipeline: ${pipeline}`);
  }
}
