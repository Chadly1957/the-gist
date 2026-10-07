import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";

export const dynamic = "force-dynamic";

async function profileFromToken(token: string | null) {
  if (!token) return null;
  return basePrisma.sponsorProfile.findUnique({ where: { magicToken: token } });
}

// Remove one of this sponsor's deals.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get("token");
  const profile = await profileFromToken(token);
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  const deal = await basePrisma.deal.findFirst({
    where: { id: params.id, workspaceId: profile.workspaceId },
    include: { dealWeek: { include: { retailer: { select: { sponsorId: true } } } } },
  });
  if (!deal || deal.dealWeek.retailer.sponsorId !== profile.id) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }
  await basePrisma.deal.delete({ where: { id: deal.id } });
  return NextResponse.json({ ok: true });
}
