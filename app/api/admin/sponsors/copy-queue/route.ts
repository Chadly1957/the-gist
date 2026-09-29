import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Bookings where Chad needs to write the ad copy: paid, copy requested,
// and no final copy written yet.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tasks = await prisma.sponsorWeekBooking.findMany({
      where: { chadWritesCopy: true, finalAdCopy: null, status: "paid" },
      orderBy: [{ week: { weekStart: "asc" } }, { createdAt: "asc" }],
      include: { week: { select: { weekStart: true } } },
    });
    return NextResponse.json(tasks);
  } catch (err) {
    console.error("[admin/sponsors/copy-queue] list failed:", err);
    return NextResponse.json({ error: "Failed to load copy queue." }, { status: 500 });
  }
}

// Finalize ad copy for a booking: store it and push it onto all projected
// daily AdBooking rows so the newsletter send uses the final copy.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId, finalAdCopy } = await req.json();
  if (!bookingId || typeof finalAdCopy !== "string" || finalAdCopy.trim().length === 0) {
    return NextResponse.json({ error: "bookingId and a non-empty finalAdCopy are required." }, { status: 400 });
  }
  const copy = finalAdCopy.trim();
  const now = new Date();

  try {
    const booking = await prisma.sponsorWeekBooking.findUnique({ where: { id: bookingId } });
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    await prisma.$transaction([
      prisma.sponsorWeekBooking.update({
        where: { id: bookingId },
        data: { finalAdCopy: copy, copyFinalizedAt: now },
      }),
      prisma.adBooking.updateMany({
        where: { sponsorWeekBookingId: bookingId },
        data: { body: copy, status: "approved", approvedAt: now },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/sponsors/copy-queue] finalize failed:", err);
    return NextResponse.json({ error: "Failed to finalize copy." }, { status: 500 });
  }
}
