import { NextRequest, NextResponse } from "next/server";
import { isRefreshInterval } from "@/lib/coupons/intervals";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

const MAX_ACTIVE_PER_SPONSOR = 5;

async function profileFromToken(token: string | null) {
  if (!token) return null;
  return prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
}

export async function GET(req: NextRequest) {
  const profile = await profileFromToken(req.nextUrl.searchParams.get("token"));
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const coupons = await db.coupon.findMany({
    where: { sponsorId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ coupons });
}

export async function POST(req: NextRequest) {
  const { token, title, description, terms, refreshInterval } = await req.json();

  const profile = await profileFromToken(token);
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const cleanTitle = title?.trim() || "";
  if (!cleanTitle) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (cleanTitle.length > 80) return NextResponse.json({ error: "Title must be 80 characters or less." }, { status: 400 });

  const cleanDescription = description?.trim() || "";
  const cleanTerms = terms?.trim() || "";
  if (cleanDescription.length > 2000) return NextResponse.json({ error: "Description must be 2000 characters or less." }, { status: 400 });
  if (cleanTerms.length > 2000) return NextResponse.json({ error: "Terms must be 2000 characters or less." }, { status: 400 });

  // Renewing coupon: one use per customer per interval, auto-refreshes.
  if (!isRefreshInterval(refreshInterval)) {
    return NextResponse.json({ error: "Pick how often it refreshes: daily, weekly, or monthly." }, { status: 400 });
  }

  const activeCount = await db.coupon.count({
    where: { sponsorId: profile.id, active: true },
  });
  if (activeCount >= MAX_ACTIVE_PER_SPONSOR) {
    return NextResponse.json(
      { error: `You already have ${MAX_ACTIVE_PER_SPONSOR} active coupons. Deactivate one before adding another.` },
      { status: 400 }
    );
  }

  const coupon = await db.coupon.create({
    data: {
      workspaceId: profile.workspaceId,
      businessName: profile.businessName,
      title: cleanTitle,
      description: cleanDescription,
      terms: cleanTerms,
      maxRedemptions: null,
      refreshInterval,
      active: true,
      contactEmail: profile.email,
      sponsorId: profile.id,
    },
  });

  return NextResponse.json({ coupon });
}
