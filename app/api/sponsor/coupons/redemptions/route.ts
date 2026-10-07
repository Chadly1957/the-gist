import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function profileFromToken(token: string | null) {
  if (!token) return null;
  return prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
}

// Recent redemptions of this sponsor's coupons, newest first.
// Powers the "Redemptions" section of the sponsor portal.
export async function GET(req: NextRequest) {
  const profile = await profileFromToken(req.nextUrl.searchParams.get("token"));
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const redemptions = await prisma.couponRedemption.findMany({
    where: {
      workspaceId: profile.workspaceId,
      coupon: { sponsorId: profile.id, workspaceId: profile.workspaceId },
    },
    orderBy: { redeemedAt: "desc" },
    take: 100,
    include: {
      coupon: { select: { title: true, businessName: true } },
      purchase: { select: { email: true } },
    },
  });

  return NextResponse.json({
    redemptions: redemptions.map((r) => ({
      id: r.id,
      couponTitle: r.coupon.title,
      businessName: r.coupon.businessName,
      buyerEmail: r.purchase.email,
      redeemedAt: r.redeemedAt,
      notes: r.notes,
    })),
  });
}
