// Nominatim (OpenStreetMap) geocoding for event locations.
//
// $0, no API key, no billing account, no Google. Nominatim's usage policy
// allows at most 1 request/second, so callers must stay sequential and
// space bulk lookups out (see sleepBetweenLookups). Results are cached
// permanently in the Event latitude/longitude columns and never re-looked
// up unless the location text changes.
//
// A pin is only ever written when Nominatim returns a specific feature
// (an address, a venue, a park) near the workspace's own town. Vague
// strings like "Downtown" and city-level matches are rejected on purpose:
// a wrong pin is worse than no pin, and an unpinned event still shows in
// the list.
import { basePrisma } from "./db-base";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Identify the app per Nominatim's usage policy.
const USER_AGENT = "The Gist Events (https://thegistdecatur.com; contact chad@thegistdecatur.com)";
// Nominatim answers usually land in well under a second; anything slower
// is not worth holding an admin approval (or a cron run) up for.
const LOOKUP_TIMEOUT_MS = 6000;
// A pin must land within this distance of the workspace's center, so a
// same-named street in another town never becomes a pin here.
const MAX_DISTANCE_KM = 30;

// Result classes Nominatim returns for places too vague to pin: whole
// towns, counties, neighbourhoods and the like. Anything else (amenity,
// building, shop, leisure, tourism, an address) is a specific feature.
const VAGUE_TYPES = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "county",
  "state",
  "country",
  "suburb",
  "neighbourhood",
  "postcode",
  "municipality",
]);

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export interface GeocodeCenter {
  area: string;
  latitude: number | null;
  longitude: number | null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// A location too vague to even ask about: a single word with no number
// ("Downtown") or just the town name itself. Multi-word venue names
// ("Golden Fox Brewing") and street addresses always get a lookup.
export function isVagueLocation(location: string, area: string): boolean {
  const text = location.trim();
  if (!text) return true;
  if (text.toLowerCase() === area.trim().toLowerCase()) return true;
  const words = text.split(/\s+/);
  if (words.length === 1 && !/\d/.test(text)) return true;
  return false;
}

interface NominatimHit {
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  display_name?: string;
}

async function nominatimSearch(
  query: string,
  center: GeocodeCenter,
): Promise<NominatimHit | null> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    addressdetails: "0",
  });
  // Bias (and, when a center exists, bound) the search to the workspace's
  // own town, so "First Street" lands in Decatur and not Springfield.
  if (center.latitude != null && center.longitude != null) {
    const d = 0.25; // ~28 km box around the center
    params.set(
      "viewbox",
      [
        center.longitude - d,
        center.latitude - d,
        center.longitude + d,
        center.latitude + d,
      ].join(","),
    );
    params.set("bounded", "1");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const hits = (await res.json()) as NominatimHit[];
    return hits.length > 0 ? hits[0] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function acceptHit(hit: NominatimHit, center: GeocodeCenter): GeocodeResult | null {
  if (hit.class === "boundary") return null;
  if (hit.type && VAGUE_TYPES.has(hit.type)) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (center.latitude != null && center.longitude != null) {
    if (haversineKm(center.latitude, center.longitude, lat, lng) > MAX_DISTANCE_KM) return null;
  } else {
    // No stored center to measure against: only trust a hit whose own
    // display name puts it in this workspace's town.
    const name = (hit.display_name || "").toLowerCase();
    if (!name.includes(center.area.trim().toLowerCase())) return null;
  }
  return { latitude: lat, longitude: lng };
}

// One lookup, two attempts: the full "location, town" query first, then
// the bare location name (venue names often match better without the
// town appended). Returns null when nothing specific enough turns up.
export async function geocodeEventLocation(
  location: string,
  center: GeocodeCenter,
): Promise<GeocodeResult | null> {
  if (isVagueLocation(location, center.area)) return null;
  const queries = [`${location.trim()}, ${center.area}`, location.trim()];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    const hit = await nominatimSearch(queries[i], center);
    if (!hit) continue;
    const accepted = acceptHit(hit, center);
    if (accepted) return accepted;
  }
  return null;
}

export function sleepBetweenLookups(ms = 1100): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Geocode one event's location and store the result. Never throws and
// never overwrites coordinates that are already stored (unless force is
// set, for when the location text itself changed). Safe to call from
// approval paths: a failed lookup just leaves the event list-only.
export async function geocodeAndStoreEvent(
  eventId: string,
  location: string | null,
  workspaceId: string,
  opts?: { force?: boolean },
): Promise<GeocodeResult | null> {
  try {
    if (!location?.trim()) return null;
    const [event, workspace] = await Promise.all([
      basePrisma.event.findUnique({ where: { id: eventId }, select: { latitude: true, longitude: true } }),
      basePrisma.workspace.findUnique({ where: { id: workspaceId } }),
    ]);
    if (!workspace) return null;
    if (!opts?.force && event?.latitude != null && event?.longitude != null) return null;
    const result = await geocodeEventLocation(location, {
      area: workspace.area,
      latitude: workspace.latitude,
      longitude: workspace.longitude,
    });
    if (!result) return null;
    await basePrisma.event.update({
      where: { id: eventId },
      data: { latitude: result.latitude, longitude: result.longitude },
    });
    return result;
  } catch (err) {
    console.error(`Geocode failed for event ${eventId}:`, err);
    return null;
  }
}
