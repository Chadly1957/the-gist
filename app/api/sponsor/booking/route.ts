import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDayDiscount } from "@/lib/discount";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { token, type, dates, date, headline, body, ctaUrl, ctaLabel, imageUrl, presentingBlurb } = await req.json();

  if (!token) return NextResponse.json({ error: "Token required." }, { status: 401 });

  const profile = await prisma.sponsorProfile.findUnique({ where: { magicToken: token } });
  if (!profile) return NextResponse.json({ error: "Invalid token." }, { status: 401 });

  // Accept either a single `date` or an array `dates`
  const requestedDates: string[] = dates?.length ? dates : date ? [date] : [];

  if (!type || !requestedDates.length || !headline || !body || !ctaUrl) {
    return NextResponse.json({ error: "Type, date(s), headline, body, and CTA URL are required." }, { status: 400 });
  }

  if (!["in_article", "presenting"].includes(type)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  if (body.length > 400) {
    return NextResponse.json({ error: "Body must be 400 characters or less." }, { status: 400 });
  }

  const takenStatuses = ["pending_review", "approved", "pending_payment"];
  const inArticleLimit = 2;

  // Check all requested dates for availability; auto-substitute conflicted ones
  const confirmedDates: string[] = [];
  const substitutions: Array<{ original: string; replacement: string }> = [];

  const sortedDates = [...requestedDates].sort();
  const lastRequested = sortedDates[sortedDates.length - 1];

  for (const d of requestedDates) {
    const existing = await prisma.adBooking.findMany({
      where: { date: d, type, status: { in: takenStatuses } },
    });
    const taken = type === "in_article" ? existing.length >= inArticleLimit : existing.length >= 1;

    if (!taken) {
      confirmedDates.push(d);
    } else {
      // Find next available date after the window
      let candidate = lastRequested;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Increment candidate by one day
        const [cy, cm, cd] = candidate.split("-").map(Number);
        const next = new Date(cy, cm - 1, cd + 1);
        candidate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;

        const alreadyChosen = confirmedDates.includes(candidate) || substitutions.some((s) => s.replacement === candidate);
        if (alreadyChosen) continue;

        const ex = await prisma.adBooking.findMany({
          where: { date: candidate, type, status: { in: takenStatuses } },
        });
        const cTaken = type === "in_article" ? ex.length >= inArticleLimit : ex.length >= 1;
        if (!cTaken) {
          substitutions.push({ original: d, replacement: candidate });
          confirmedDates.push(candidate);
          break;
        }
      }
    }
  }

  const totalDays = confirmedDates.length;
  const discountPct = getDayDiscount(totalDays);

  const bookings = await Promise.all(
    confirmedDates.map((d) =>
      prisma.adBooking.create({
        data: {
          sponsorId: profile.id,
          type,
          date: d,
          discountPct,
          headline: headline.trim(),
          body: body.trim(),
          ctaUrl: ctaUrl.trim(),
          ctaLabel: ctaLabel?.trim() || "Learn More",
          imageUrl: imageUrl?.trim() || null,
          presentingBlurb: presentingBlurb?.trim() || null,
        },
      })
    )
  );

  return NextResponse.json({ bookings, substitutions, discountPct });
}
