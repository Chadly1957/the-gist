// Printed QR codes whose visits get logged (2026-11-24, Chad's call).
// A code matches only on its exact pathname + UTM triple, on any host
// (www or apex). Nothing else is tracked: the untagged QR codes (generic
// scan cards, counter cards, weekend /join codes) point at bare URLs shared
// with all other traffic, so the server cannot tell a scan from a visit.
export interface QrCodeDef {
  code: string;
  label: string;
  pathname: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

export const QR_CODES: QrCodeDef[] = [
  {
    code: "flyer-dinner-club",
    label: "Dinner Club flyer",
    pathname: "/dinner-club",
    utmSource: "flyer",
    utmMedium: "print",
    utmCampaign: "dinner-club",
  },
  {
    code: "banner-signup",
    label: "Homepage banner",
    pathname: "/",
    utmSource: "banner",
    utmMedium: "print",
    utmCampaign: "signup",
  },
];

export function matchQrCode(pathname: string, params: URLSearchParams): QrCodeDef | null {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  for (const def of QR_CODES) {
    if (
      path === def.pathname &&
      params.get("utm_source") === def.utmSource &&
      params.get("utm_medium") === def.utmMedium &&
      params.get("utm_campaign") === def.utmCampaign
    ) {
      return def;
    }
  }
  return null;
}

// Coarse device class from the user-agent. No IP or personal data is read.
export function deviceFromUa(ua: string): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!ua) return "unknown";
  const u = ua.toLowerCase();
  if (u.includes("ipad") || u.includes("tablet")) return "tablet";
  if (u.includes("mobi") || u.includes("android") || u.includes("iphone") || u.includes("ipod")) return "mobile";
  return "desktop";
}

// Link-preview and crawler fetches are not scans: a preview hit opens the
// page without a human pointing a camera at a code. Conservative list on
// purpose; a real phone browser never contains these.
const BOT_SUBSTRINGS = [
  "bot",
  "spider",
  "crawl",
  "slurp",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "telegrambot",
  "discordbot",
  "googlebot",
  "bingbot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "applebot",
  "pinterestbot",
  "redditbot",
];

export function isBotUa(ua: string): boolean {
  const u = ua.toLowerCase();
  for (const b of BOT_SUBSTRINGS) {
    if (u.includes(b)) return true;
  }
  return false;
}
