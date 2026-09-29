import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { presentingSlotFree } from "@/lib/sponsor-weeks";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const original = await prisma.adBooking.findUnique({ where: { id: params.id } });
  if (!original) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  // Presenting is a hard cap: 1 per issue, no exceptions, on any path.
  if (original.type === "presenting" && !(await presentingSlotFree(original.workspaceId, original.date))) {
    return NextResponse.json(
      { error: `Presenting slot is already taken for ${original.date}. Hard cap: 1 per issue, no exceptions.` },
      { status: 409 }
    );
  }

  const copy = await prisma.adBooking.create({
    data: {
      sponsorId: original.sponsorId,
      type: original.type,
      date: original.date,
      headline: original.headline,
      body: original.body,
      ctaUrl: original.ctaUrl,
      ctaLabel: original.ctaLabel,
      imageUrl: original.imageUrl,
      presentingBlurb: original.presentingBlurb,
      status: "pending_review",
      isPaid: false,
    },
    include: {
      sponsor: { select: { businessName: true, contactName: true, email: true } },
    },
  });

  return NextResponse.json({ booking: copy });
}
