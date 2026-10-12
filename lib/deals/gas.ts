// Current gas prices for the Deals Book bento box.
//
// Daily source: a scheduled agent scrapes GasBuddy (free, no API key) for each
// workspace's cities and POSTs the results to /api/admin/deals/gas-prices,
// which stores them in the workspace's `gasPrices` Setting as JSON.
// getGasPrices() below reads that Setting; the portal bento box shows the
// 5 cheapest stations when live.
//
// Fallback: the GasBuddy scrape is regularly hard-blocked by Cloudflare, so
// when the station data is missing or stale, getGasPrices() falls back to the
// U.S. EIA weekly Chicago regular-gasoline retail average (free key, no
// billing, government source; EIA publishes no Illinois state series, and
// Chicago is the closest published benchmark). The reader sees it clearly
// labeled as a weekly Chicago average, never as station-level prices. If
// EIA_API_KEY is unset or the EIA call fails, we degrade to the old behavior
// (stale stations if any, otherwise "coming soon") — never a crash, never an
// empty wipe.

import { basePrisma } from "@/lib/db-base";

export interface GasStationPrice {
  name: string;
  regular: number | null; // dollars per gallon
  city?: string;
  updatedAt: string; // ISO timestamp
}

export interface GasPriceData {
  live: boolean;
  stations: GasStationPrice[];
  updatedAt: string | null;
  /** "stations" = fresh GasBuddy scrape, "eia" = weekly Chicago average fallback, "none" = nothing to show */
  source: "stations" | "eia" | "none";
  /** dollars/gal, set when source === "eia" */
  eiaPrice?: number | null;
  /** EIA week label (e.g. "2026-10-05"), set when source === "eia" */
  eiaPeriod?: string | null;
}

const SETTING_KEY = "gasPrices";
const EIA_SETTING_KEY = "gasPricesEia";
// Station data older than this is treated as stale and yields to the EIA fallback.
const STATION_FRESH_MS = 36 * 60 * 60 * 1000;
// EIA publishes weekly; refresh the cached value at most once a day.
const EIA_CACHE_MS = 24 * 60 * 60 * 1000;

interface EiaCache {
  price: number;
  period: string;
  fetchedAt: string;
}

async function readEiaCache(workspaceId: string): Promise<EiaCache | null> {
  try {
    const setting = await basePrisma.setting.findUnique({
      where: { workspaceId_key: { workspaceId, key: EIA_SETTING_KEY } },
    });
    if (!setting) return null;
    const data = JSON.parse(setting.value) as EiaCache;
    if (typeof data.price !== "number" || !data.fetchedAt) return null;
    return data;
  } catch {
    return null;
  }
}

async function writeEiaCache(workspaceId: string, cache: EiaCache): Promise<void> {
  try {
    await basePrisma.setting.upsert({
      where: { workspaceId_key: { workspaceId, key: EIA_SETTING_KEY } },
      create: { workspaceId, key: EIA_SETTING_KEY, value: JSON.stringify(cache) },
      update: { value: JSON.stringify(cache) },
    });
  } catch {
    // Cache is best-effort; a write failure must not break the read path.
  }
}

// Weekly Chicago regular-grade retail gasoline price from U.S. EIA Open Data.
// Endpoint: GET https://api.eia.gov/v2/petroleum/pri/gnd/data/
// Facets: duoarea=YORD (Chicago), product=EPMR (regular gasoline).
// Verified live 2026-10-12 (week of 2026-10-05: $4.633/gal).
// Free key, no billing: https://www.eia.gov/opendata/register.php
async function fetchEiaChicagoAverage(
  apiKey: string
): Promise<{ price: number; period: string } | null> {
  const url = new URL("https://api.eia.gov/v2/petroleum/pri/gnd/data/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("frequency", "weekly");
  url.searchParams.set("data[0]", "value");
  url.searchParams.set("facets[duoarea][]", "YORD");
  url.searchParams.set("facets[product][]", "EPMR");
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("length", "1");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url.toString(), {
      signal: ctl.signal,
      headers: { "User-Agent": "TheGistDeals/1.0" },
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as {
      response?: { data?: Array<{ value?: unknown; period?: unknown }> };
    } | null;
    const row = json?.response?.data?.[0];
    const raw = row?.value;
    const price =
      typeof raw === "string" ? parseFloat(raw) : typeof raw === "number" ? raw : NaN;
    if (!isFinite(price) || price <= 0) return null;
    const period = typeof row?.period === "string" ? row.period : "";
    return { price, period };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getEiaFallback(workspaceId: string): Promise<GasPriceData | null> {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey) return null;
  const cached = await readEiaCache(workspaceId);
  const cacheFresh =
    cached && Date.now() - new Date(cached.fetchedAt).getTime() < EIA_CACHE_MS;
  if (cacheFresh && cached) {
    return {
      live: true,
      stations: [],
      updatedAt: cached.fetchedAt,
      source: "eia",
      eiaPrice: cached.price,
      eiaPeriod: cached.period,
    };
  }
  const fresh = await fetchEiaChicagoAverage(apiKey);
  if (fresh) {
    const fetchedAt = new Date().toISOString();
    await writeEiaCache(workspaceId, {
      price: fresh.price,
      period: fresh.period,
      fetchedAt,
    });
    return {
      live: true,
      stations: [],
      updatedAt: fetchedAt,
      source: "eia",
      eiaPrice: fresh.price,
      eiaPeriod: fresh.period,
    };
  }
  // EIA unreachable: use the cached value if we have one (clearly dated), else nothing.
  if (cached) {
    return {
      live: true,
      stations: [],
      updatedAt: cached.fetchedAt,
      source: "eia",
      eiaPrice: cached.price,
      eiaPeriod: cached.period,
    };
  }
  return null;
}

export async function getGasPrices(workspaceId: string): Promise<GasPriceData> {
  const setting = await basePrisma.setting.findUnique({
    where: { workspaceId_key: { workspaceId, key: SETTING_KEY } },
  });
  let stations: GasStationPrice[] = [];
  let updatedAt: string | null = null;
  if (setting) {
    try {
      const data = JSON.parse(setting.value) as {
        stations?: GasStationPrice[];
        updatedAt?: string;
      };
      if (Array.isArray(data.stations)) stations = data.stations;
      updatedAt = data.updatedAt || null;
    } catch {
      // fall through to fallback handling
    }
  }
  const stationFresh =
    stations.length > 0 &&
    updatedAt !== null &&
    Date.now() - new Date(updatedAt).getTime() < STATION_FRESH_MS;
  if (stationFresh) {
    return { live: true, stations, updatedAt, source: "stations" };
  }
  // Missing or stale station data: try the EIA weekly-average fallback.
  const eia = await getEiaFallback(workspaceId);
  if (eia) return eia;
  // No key / EIA down: keep showing stale stations (dated) rather than wiping,
  // otherwise fall back to the old "coming soon" state.
  if (stations.length > 0) {
    return { live: true, stations, updatedAt, source: "stations" };
  }
  return { live: false, stations: [], updatedAt: null, source: "none" };
}

// Sort cheapest-first, keep the best N for the bento box.
export function normalizeStations(
  stations: { name: string; regular: number | null; city?: string }[],
  limit = 10
): GasStationPrice[] {
  const now = new Date().toISOString();
  return stations
    .filter((s) => s.name && typeof s.regular === "number" && s.regular > 0)
    .sort((a, b) => (a.regular as number) - (b.regular as number))
    .slice(0, limit)
    .map((s) => ({ name: s.name.trim(), regular: s.regular, city: s.city, updatedAt: now }));
}
