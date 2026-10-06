import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const dynamic = "force-dynamic";

async function ownedCoupon(token: string | null, id: string) {
  const profile = token
    ? await prisma.sponsorProfile.findUnique({ where: { magicToken: token } })
    : null;
  if (!profile) return { profile: null, coupon: null };
  const coupon = await db.coupon.findFirst({
    where: { id, sponsorId: profile.id },
  });
  return { profile, coupon };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { token, title, description, terms, maxRedemptions, active } = await req.json();

  const { coupon } = await ownedCoupon(token, params.id);
  if (!coupon) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (title !== undefined) {
    const cleanTitle = title?.trim() || "";
    if (!cleanTitle) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (cleanTitle.length > 80) return NextResponse.json({ error: "Title must be 80 characters or less." }, { status: 400 });
    data.title = cleanTitle;
  }
  if (description !== undefined) {
    const clean = description?.trim() || "";
    if (clean.length > 2000) return NextResponse.json({ error: "Description must be 2000 characters or less." }, { status: 400 });
    data.description = clean;
  }
  if (terms !== undefined) {
    const clean = terms?.trim() || "";
    if (clean.length > 2000) return NextResponse.json({ error: "Terms must be 2000 characters or less." }, { status: 400 });
    data.terms = clean;
  }
  if (maxRedemptions !== undefined) {
    if (maxRedemptions === null || maxRedemptions === "") {
      data.maxRedemptions = null;
    } else {
      const uses = Number(maxRedemptions);
      if (!Number.isInteger(uses) || uses < 1) {
        return NextResponse.json({ error: "Redemption count must be a whole number of 1 or more, or left blank for unlimited." }, { status: 400 });
      }
      data.maxRedemptions = uses;
    }
  }
  if (active !== undefined) {
    data.active = Boolean(active);
  }

  // Enforce the active cap when re-activating.
  if (data.active === true && !coupon.active) {
    const activeCount = await db.coupon.count({
      where: { sponsorId: coupon.sponsorId, active: true },
    });
    if (activeCount >= 5) {
      return NextResponse.json(
        { error: "You already have 5 active coupons. Deactivate one before re-activating this one." },
        { status: 400 }
      );
    }
  }

  const updated = await db.coupon.update({ where: { id: coupon.id }, data });
  return NextResponse.json({ coupon: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  const { coupon } = await ownedCoupon(token, params.id);
  if (!coupon) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });

  await db.coupon.delete({ where: { id: coupon.id } });
  return NextResponse.json({ ok: true });
}
