import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { ensureManualWeek } from "@/lib/deals/refresh";
import { mondayOfWeek, sundayOfWeek } from "@/lib/deals/week";

export const dynamic = "force-dynamic";

async function profileFromToken(token: string | null) {
  if (!token) return null;
  return basePrisma.sponsorProfile.findUnique({ where: { magicToken: token } });
}

// Each sponsor gets their own retailer row (their deals section in the book,
// like Target or Aldi). Created on first use.
async function ensureSponsorRetailer(profile: { id: string; workspaceId: string; businessName: string }) {
  const existing = await basePrisma.retailer.findFirst({
    where: { workspaceId: profile.workspaceId, sponsorId: profile.id },
  });
  if (existing) return existing;
  return basePrisma.retailer.create({
    data: {
      workspaceId: profile.workspaceId,
      slug: `sponsor-${profile.id.slice(0, 8)}`,
      displayName: profile.businessName,
      pipeline: "manual",
      storeConfig: "{}",
      sponsorId: profile.id,
      active: true,
    },
  });
}

const CADENCE_DAYS: Record<string, number> = { weekly: 7, monthly: 30 };

// List this sponsor's deals (active ones first).
export async function GET(req: NextRequest) {
  const profile = await profileFromToken(req.nextUrl.searchParams.get("token"));
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const retailer = await basePrisma.retailer.findFirst({
    where: { workspaceId: profile.workspaceId, sponsorId: profile.id },
    select: { id: true, displayName: true, logoUrl: true },
  });
  if (!retailer) return NextResponse.json({ deals: [], retailer: null });

  const now = new Date();
  const deals = await basePrisma.deal.findMany({
    where: {
      workspaceId: profile.workspaceId,
      dealWeek: { retailerId: retailer.id },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { sortOrder: "desc" },
    select: { id: true, title: true, price: true, summary: true, expiresAt: true },
  });
  return NextResponse.json({ deals, retailer });
}

// Post a deal. Goes live in the book immediately under the sponsor's own section.
export async function POST(req: NextRequest) {
  const { token, title, price, description, cadence } = await req.json();
  const profile = await profileFromToken(token);
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const cleanTitle = title?.trim() || "";
  if (!cleanTitle) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (cleanTitle.length > 120) return NextResponse.json({ error: "Title must be 120 characters or less." }, { status: 400 });
  if (!CADENCE_DAYS[cadence]) return NextResponse.json({ error: "Pick weekly or monthly." }, { status: 400 });

  const retailer = await ensureSponsorRetailer(profile);
  const week = await ensureManualWeek(profile.workspaceId, retailer.id, mondayOfWeek(), sundayOfWeek());
  const maxOrder = await basePrisma.deal.aggregate({
    where: { workspaceId: profile.workspaceId, dealWeekId: week.id },
    _max: { sortOrder: true },
  });

  const expiresAt = new Date(Date.now() + CADENCE_DAYS[cadence] * 24 * 60 * 60 * 1000);
  const deal = await basePrisma.deal.create({
    data: {
      workspaceId: profile.workspaceId,
      dealWeekId: week.id,
      businessName: profile.businessName,
      title: cleanTitle,
      price: price?.trim()?.slice(0, 40) || null,
      summary: description?.trim()?.slice(0, 500) || "",
      expiresAt,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ deal });
}

// Update the business logo shown with the sponsor's deals section.
export async function PUT(req: NextRequest) {
  const { token, logoUrl } = await req.json();
  const profile = await profileFromToken(token);
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const retailer = await ensureSponsorRetailer(profile);
  const clean = logoUrl?.trim()?.slice(0, 500) || null;
  await basePrisma.retailer.update({ where: { id: retailer.id }, data: { logoUrl: clean } });
  return NextResponse.json({ ok: true, logoUrl: clean });
}
