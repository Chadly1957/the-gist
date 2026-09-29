import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getDayDiscount } from "@/lib/discount";
import { presentingSlotFree } from "@/lib/sponsor-weeks";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId, type, dates, date, headline, body, ctaUrl, ctaLabel, imageUrl, presentingBlurb, status, isComp, adminNotes } = await req.json();

  // Accept either `dates` array or single `date`
  const bookingDates: string[] = dates?.length ? dates : date ? [date] : [];

  if (!profileId || !type || bookingDates.length === 0 || !headline || !body || !ctaUrl || !ctaLabel) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // Presenting is a hard cap: 1 per issue, no exceptions, on any path
  // including admin. Reject before creating anything.
  if (type === "presenting") {
    for (const d of bookingDates) {
      if (!(await presentingSlotFree(DEFAULT_WORKSPACE_ID, d))) {
        return NextResponse.json(
          { error: `Presenting slot is already taken for ${d}. Hard cap: 1 per issue, no exceptions.` },
          { status: 409 }
        );
      }
    }
  }

  const profile = await prisma.sponsorProfile.findUnique({ where: { id: profileId } });
  if (!profile) return NextResponse.json({ error: "Sponsor not found." }, { status: 404 });

  const discountPct = getDayDiscount(bookingDates.length);
  const resolvedStatus = status || "approved";
  const approvedAt = resolvedStatus === "approved" ? new Date() : null;
  const comp = isComp === true;

  const bookings = await Promise.all(
    bookingDates.map((d) =>
      prisma.adBooking.create({
        data: {
          sponsorId: profile.id,
          type,
          date: d,
          discountPct,
          headline,
          body,
          ctaUrl,
          ctaLabel,
          imageUrl: imageUrl || null,
          presentingBlurb: presentingBlurb || null,
          status: resolvedStatus,
          isPaid: false,
          isComp: comp,
          adminNotes: adminNotes || null,
          approvedAt,
        },
      })
    )
  );

  return NextResponse.json({ booking: bookings[0], bookings });
}
