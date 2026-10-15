import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { pathWorkspace } from "./lib/workspace-constants";
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production-32chars");

export async function middleware(req: NextRequest) {
  const scoped = pathWorkspace(req.nextUrl.pathname);
  const pathname = scoped?.pathname || req.nextUrl.pathname;
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
