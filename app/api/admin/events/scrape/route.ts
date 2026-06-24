import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ScrapedEvent {
  title?: string;
  description?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  url?: string;
  found: Record<string, boolean>;
  warnings: string[];
}

function getMeta(html: string, property: string): string | undefined {
  const match = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
  ) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i")
  );
  return match ? match[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : undefined;
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch { /* skip invalid JSON-LD */ }
  }
  return results;
}

function findEventJsonLd(items: Record<string, unknown>[]): Record<string, unknown> | undefined {
  for (const item of items) {
    if (item["@type"] === "Event") return item;
    if (item["@graph"] && Array.isArray(item["@graph"])) {
      const found = (item["@graph"] as Record<string, unknown>[]).find((n) => n["@type"] === "Event");
      if (found) return found;
    }
  }
  return undefined;
}

function parseIsoDate(iso: string): { date: string; time: string } | undefined {
  // Handles "2025-07-04T19:00:00", "2025-07-04T19:00:00-05:00", "2025-07-04"
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return undefined;
  const date = match[1];
  if (!match[2]) return { date, time: "" };
  let h = parseInt(match[2], 10);
  const m = match[3];
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return { date, time: `${h}:${m} ${ampm}` };
}

function extractLocation(loc: unknown): string | undefined {
  if (!loc) return undefined;
  if (typeof loc === "string") return loc.trim() || undefined;
  if (typeof loc === "object") {
    const l = loc as Record<string, unknown>;
    const name = typeof l.name === "string" ? l.name.trim() : "";
    const addr = l.address;
    if (typeof addr === "string") return [name, addr].filter(Boolean).join(", ") || undefined;
    if (addr && typeof addr === "object") {
      const a = addr as Record<string, unknown>;
      const parts = [name, a.streetAddress, a.addressLocality, a.addressRegion].filter((p) => typeof p === "string" && p.trim());
      return (parts as string[]).join(", ") || undefined;
    }
    return name || undefined;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  const isFacebook =
    parsedUrl.hostname === "facebook.com" ||
    parsedUrl.hostname === "www.facebook.com" ||
    parsedUrl.hostname === "fb.com" ||
    parsedUrl.hostname === "www.fb.com";

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch the page (HTTP ${res.status}). Check the URL and try again.` },
        { status: 400 }
      );
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch URL: ${msg}` }, { status: 400 });
  }

  const result: ScrapedEvent = { found: {}, warnings: [] };

  // ── JSON-LD (most reliable for Eventbrite, venue sites) ──────────────────
  const jsonLdItems = extractJsonLd(html);
  const eventNode = findEventJsonLd(jsonLdItems);

  if (eventNode) {
    if (typeof eventNode.name === "string" && eventNode.name.trim()) {
      result.title = eventNode.name.trim();
      result.found.title = true;
    }
    if (typeof eventNode.description === "string" && eventNode.description.trim()) {
      result.description = eventNode.description.trim().slice(0, 1000);
      result.found.description = true;
    }
    if (typeof eventNode.startDate === "string") {
      const parsed = parseIsoDate(eventNode.startDate);
      if (parsed) {
        result.eventDate = parsed.date;
        result.found.eventDate = true;
        if (parsed.time) {
          result.startTime = parsed.time;
          result.found.startTime = true;
        }
      }
    }
    if (typeof eventNode.endDate === "string") {
      const parsed = parseIsoDate(eventNode.endDate);
      if (parsed?.time) {
        result.endTime = parsed.time;
        result.found.endTime = true;
      }
    }
    const loc = extractLocation(eventNode.location);
    if (loc) {
      result.location = loc;
      result.found.location = true;
    }
    const eventUrl = typeof eventNode.url === "string" ? eventNode.url.trim() : undefined;
    if (eventUrl) {
      result.url = eventUrl;
      result.found.url = true;
    }
  }

  // ── OG meta tags (fallback / supplement) ─────────────────────────────────
  if (!result.title) {
    const ogTitle = getMeta(html, "og:title") || getMeta(html, "twitter:title");
    if (ogTitle) {
      // Strip common suffixes
      result.title = ogTitle
        .replace(/\s*[\|–—-]\s*Facebook\s*$/i, "")
        .replace(/\s*[\|–—-]\s*Eventbrite\s*$/i, "")
        .trim();
      result.found.title = true;
    }
  }

  if (!result.description) {
    const ogDesc = getMeta(html, "og:description") || getMeta(html, "description");
    if (ogDesc) {
      result.description = ogDesc.slice(0, 1000);
      result.found.description = true;
    }
  }

  if (!result.url) {
    result.url = url;
    result.found.url = true;
  }

  // ── Facebook-specific warnings ────────────────────────────────────────────
  if (isFacebook) {
    if (!result.found.eventDate) {
      result.warnings.push(
        "Facebook doesn't expose event date/time in static page HTML — please fill in the date and time manually."
      );
    }
    if (!result.found.location) {
      result.warnings.push("Location was not found in the page — fill it in manually if needed.");
    }
  }

  if (!result.title) {
    return NextResponse.json(
      { error: "Could not extract any event details from this page. Try a different URL or enter details manually." },
      { status: 422 }
    );
  }

  return NextResponse.json({ event: result });
}
