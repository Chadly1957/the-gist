import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaces = await basePrisma.workspace.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true, area: true, domain: true, latitude: true, longitude: true, timezone: true, primaryColor: true, secondaryColor: true, _count: { select: { subscriberRows: true, sourceRows: true, newsletterSendRows: true } } },
  });
  return NextResponse.json({ workspaces, currentId: (await getWorkspace()).id });
}

function parseCoordinate(value: unknown, min: number, max: number): number | null | undefined {
  // Returns undefined when absent/blank, null when invalid, otherwise the number.
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function parseColor(value: unknown): string | null | undefined {
  // Returns undefined when absent/blank, null when invalid, otherwise the hex.
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  const v = String(value).trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

const US_TIMEZONES = new Set([
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
]);
export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const area = typeof body?.area === "string" ? body.area.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!name || name.length > 100 || !area || area.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
    return NextResponse.json({ error: "Enter a newsletter name, area, and URL slug using lowercase letters, numbers, and hyphens." }, { status: 400 });
  }
  const latitude = parseCoordinate(body?.latitude, -90, 90);
  const longitude = parseCoordinate(body?.longitude, -180, 180);
  const timezone = typeof body?.timezone === "string" ? body.timezone.trim() : "";
  if (latitude === null || longitude === null) {
    return NextResponse.json({ error: "Enter a valid latitude (-90 to 90) and longitude (-180 to 180)." }, { status: 400 });
  }
  if (latitude === undefined || longitude === undefined) {
    return NextResponse.json({ error: "Latitude and longitude are required so location features (like the weather block) work for this city." }, { status: 400 });
  }
  if (!US_TIMEZONES.has(timezone)) {
    return NextResponse.json({ error: "Pick a timezone for this workspace." }, { status: 400 });
  }
  const primaryColor = parseColor(body?.primaryColor);
  const secondaryColor = parseColor(body?.secondaryColor);
  if (primaryColor === null || secondaryColor === null) {
    return NextResponse.json({ error: "Colors must be hex values like #15803d." }, { status: 400 });
  }
  // Give the ordinary duplicate case a clear response; the unique constraint
  // and P2002 handler below still handle concurrent creation attempts.
  if (await basePrisma.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    return NextResponse.json({ error: "That workspace URL is already in use." }, { status: 409 });
  }
  try {
    const workspace = await basePrisma.workspace.create({ data: { name, area, slug, latitude, longitude, timezone, primaryColor: primaryColor ?? "#15803d", secondaryColor: secondaryColor ?? "#166534" } });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "That workspace URL is already in use." }, { status: 409 });
    throw error;
  }
}

export async function PATCH(req: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Workspace id is required." }, { status: 400 });
  const existing = await basePrisma.workspace.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });

  const data: { name?: string; area?: string; latitude?: number; longitude?: number; timezone?: string; primaryColor?: string; secondaryColor?: string } = {};
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const area = typeof body?.area === "string" ? body.area.trim() : undefined;
  if (name !== undefined) {
    if (!name || name.length > 100) {
      return NextResponse.json({ error: "Enter a newsletter name (max 100 characters)." }, { status: 400 });
    }
    data.name = name;
  }
  if (area !== undefined) {
    if (!area || area.length > 100) {
      return NextResponse.json({ error: "Enter a town or area (max 100 characters)." }, { status: 400 });
    }
    data.area = area;
  }
  if (body?.latitude !== undefined || body?.longitude !== undefined) {
    const latitude = parseCoordinate(body?.latitude, -90, 90);
    const longitude = parseCoordinate(body?.longitude, -180, 180);
    if (latitude === null || longitude === null || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Enter a valid latitude (-90 to 90) and longitude (-180 to 180)." }, { status: 400 });
    }
    data.latitude = latitude;
    data.longitude = longitude;
  }
  if (body?.timezone !== undefined) {
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "";
    if (!US_TIMEZONES.has(timezone)) {
      return NextResponse.json({ error: "Pick a valid timezone for this workspace." }, { status: 400 });
    }
    data.timezone = timezone;
  }
  const primaryColor = parseColor(body?.primaryColor);
  if (primaryColor === null) {
    return NextResponse.json({ error: "Primary color must be a hex value like #15803d." }, { status: 400 });
  }
  if (primaryColor !== undefined) data.primaryColor = primaryColor;
  const secondaryColor = parseColor(body?.secondaryColor);
  if (secondaryColor === null) {
    return NextResponse.json({ error: "Secondary color must be a hex value like #166534." }, { status: 400 });
  }
  if (secondaryColor !== undefined) data.secondaryColor = secondaryColor;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const workspace = await basePrisma.workspace.update({ where: { id }, data });
  return NextResponse.json({ workspace });
}
