import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Use jose directly here — bcryptjs (imported by lib/auth) is not Edge-compatible
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production-32chars"
);

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPath = pathname.startsWith("/admin");
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some((p) =>
    pathname.startsWith(p)
  );

  if (!isAdminPath) return NextResponse.next();
  if (isPublicAdminPath) return NextResponse.next();

  const token = req.cookies.get("gist_admin_session")?.value;

  if (!token) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  let session = null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    session = payload;
  } catch {
    // invalid or expired token
  }
  if (!session) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("gist_admin_session");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
