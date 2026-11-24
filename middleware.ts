import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { jwtVerify } from "jose";
import { pathWorkspace } from "./lib/workspace-constants";
import { matchQrCode } from "./lib/qr-scan";
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production-32chars");

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const scoped = pathWorkspace(req.nextUrl.pathname);
  const pathname = scoped?.pathname || req.nextUrl.pathname;
  // QR scan logging (2026-11-24): a printed QR code that matches one of the
  // two tracked codes logs one hit per page open, in the background. The
  // log call never blocks or breaks the page: failures are swallowed.
  const qr = matchQrCode(pathname, req.nextUrl.searchParams);
  if (qr) {
    event.waitUntil(
      fetch(`${req.nextUrl.origin}/api/qr-scan`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9",
          // Cloudflare fronts the public domains and blocks non-browser
          // user agents, so the internal log call identifies as a browser.
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          code: qr.code,
          utmSource: qr.utmSource,
          utmMedium: qr.utmMedium,
          utmCampaign: qr.utmCampaign,
          userAgent: req.headers.get("user-agent") || "",
        }),
      }).catch(() => undefined)
    );
  }
  const requestHeaders = new Headers(req.headers);
  // Never trust a caller-supplied scope. It comes only from the URL.
  requestHeaders.delete("x-gist-workspace");
  if (scoped) requestHeaders.set("x-gist-workspace", scoped.slug);
  // A/B test variant assignment for /join. Random on first visit, sticky via
  // 30-day cookie so returning visitors always see the same version.
  // Variants: "a" = control, "b" = urgency + friction fixes.
  let joinVariant: string | null = null;
  if (pathname === "/join") {
    const valid = ["a", "b"];
    joinVariant = req.cookies.get("gist_join_variant")?.value || null;
    if (!joinVariant || !valid.includes(joinVariant)) {
      joinVariant = valid[Math.floor(Math.random() * valid.length)];
    }
    requestHeaders.set("x-join-variant", joinVariant);
  }
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  const isLogin = pathname === "/admin/login" || pathname === "/api/admin/login";
  if (isAdmin && !isLogin) {
    let valid = false;
    try {
      const { payload } = await jwtVerify(req.cookies.get("gist_admin_session")?.value || "", SECRET);
      valid = payload.role === "admin" && typeof payload.sub === "string";
    } catch { /* expired or missing session */ }
    // Preserve authenticated scheduled daily digest requests.
    const cron = pathname === "/api/admin/daily-digest" && process.env.CRON_SECRET &&
      (req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}` || req.nextUrl.searchParams.get("secret") === process.env.CRON_SECRET);
    // Secret-authenticated ingest endpoints. The cron agents can't hold an admin
    // session, so these validate a bearer secret in the route handler instead.
    // Only bypass the session check when the matching secret is configured.
    const secretIngest =
      (pathname === "/api/admin/deals/gas-prices" && process.env.GAS_INGEST_SECRET) ||
      (pathname === "/api/admin/deals/kirby-week" && process.env.KIRBY_INGEST_SECRET) ||
      (pathname === "/api/admin/deals/weekly-run" && process.env.WEEKLY_RUN_SECRET);
    if (!valid && !cron && !secretIngest) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const login = new URL(`${scoped?.prefix || ""}/admin/login`, req.url);
      login.searchParams.set("from", req.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
  }
  if (scoped) {
    const url = req.nextUrl.clone();
    url.pathname = pathname;
    const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    if (joinVariant) {
      res.cookies.set("gist_join_variant", joinVariant, {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      });
    }
    return res;
  }
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (joinVariant) {
    res.cookies.set("gist_join_variant", joinVariant, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  }
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
