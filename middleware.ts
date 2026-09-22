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
    if (!valid && !cron) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const login = new URL(`${scoped?.prefix || ""}/admin/login`, req.url);
      login.searchParams.set("from", req.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
  }
  if (scoped) {
    const url = req.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
