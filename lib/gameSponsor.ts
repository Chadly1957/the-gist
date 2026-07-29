import { prisma } from "@/lib/db";

export type GameName = "wordy" | "match";

export interface GameSponsorData {
  bookingId: string;
  businessName: string;
  headline: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
  imageUrl: string | null;
  presentingBlurb: string | null;
}

/** "Today" for game-page sponsor lookups, matching the existing Wordy convention. */
export function todayDateKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * The newsletter's presenting sponsor for a given date (defaults to today) --
 * the same AdBooking (type "presenting") shown at the top of the newsletter
 * is also shown at the top of every game page.
 */
export async function getPresentingSponsor(date: string = todayDateKey()): Promise<GameSponsorData | null> {
  const booking = await prisma.adBooking.findFirst({
    where: { date, type: "presenting", status: "approved" },
    include: { sponsor: { select: { businessName: true } } },
  });

  if (!booking) return null;

  return {
    bookingId: booking.id,
    businessName: booking.sponsor.businessName,
    headline: booking.headline,
    body: booking.body,
    ctaUrl: booking.ctaUrl,
    ctaLabel: booking.ctaLabel,
    imageUrl: booking.imageUrl,
    presentingBlurb: booking.presentingBlurb,
  };
}

export async function recordGameSponsorEvent(bookingId: string, game: GameName, eventType: "impression" | "click") {
  await prisma.gameSponsorEvent.create({
    data: { date: todayDateKey(), game, eventType, bookingId },
  });
}
