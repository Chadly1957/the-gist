import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// List all weekly package bookings (newest weeks first), with weekStart attached.
// Stripe session IDs are intentionally excluded from the response.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const bookings = await prisma.sponsorWeekBooking.findMany({
      orderBy: [{ week: { weekStart: "asc" } }, { createdAt: "asc" }],
      select: {
        id: true,
        weekId: true,
        sponsorId: true,
        tier: true,
        status: true,
        amountCents: true,
        businessName: true,
        contactName: true,
        email: true,
        website: true,
        logoUrl: true,
        aboutText: true,
        chadWritesCopy: true,
        finalAdCopy: true,
        copyFinalizedAt: true,
        rebookToken: true,
        resultsSentAt: true,
        renewalSentAt: true,
        createdAt: true,
        week: { select: { weekStart: true } },
      },
    });

    return NextResponse.json(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bookings.map((b: any) => {
        const { week, ...rest } = b;
        return { ...rest, weekStart: week.weekStart };
      })
    );
  } catch (err) {
    console.error("[admin/sponsors/week-bookings] list failed:", err);
    return NextResponse.json({ error: "Failed to load weekly bookings." }, { status: 500 });
  }
}
