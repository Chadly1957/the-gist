// Current gas prices for the Deals Book bento box.
//
// Daily source: a scheduled agent scrapes GasBuddy (free, no API key) for each
// workspace's cities and POSTs the results to /api/admin/deals/gas-prices,
// which stores them in the workspace's `gasPrices` Setting as JSON.
// getGasPrices() below reads that Setting; the portal bento box shows the
// 5 cheapest stations when live.

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
}

const SETTING_KEY = "gasPrices";

export async function getGasPrices(workspaceId: string): Promise<GasPriceData> {
  const setting = await basePrisma.setting.findUnique({
    where: { workspaceId_key: { workspaceId, key: SETTING_KEY } },
  });
  if (!setting) return { live: false, stations: [], updatedAt: null };
  try {
    const data = JSON.parse(setting.value) as {
      stations?: GasStationPrice[];
      updatedAt?: string;
    };
    const stations = Array.isArray(data.stations) ? data.stations : [];
    if (stations.length === 0) return { live: false, stations: [], updatedAt: null };
    return { live: true, stations, updatedAt: data.updatedAt || null };
  } catch {
    return { live: false, stations: [], updatedAt: null };
  }
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
