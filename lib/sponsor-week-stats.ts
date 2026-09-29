import { prisma } from "@/lib/db";
import { addDaysISO, formatWeekRange } from "@/lib/sponsor-weeks";

const SPONSOR_LINK_TYPES: Record<string, string[]> = {
  presenting: ["presenting_sponsor"],
  standard: ["in_article_ad"],
};

export interface WeekBookingStats {
  sends: number;
  opens: number;
  clicks: number;
}

/**
 * Stats for one paid week booking, computed from newsletter sends that went
 * out during the sponsor week (Mon-Sun). This is the single source of truth
 * for week stats: the Monday results email and the sponsor portal both use it
 * so their numbers always match.
 */
export async function getWeekBookingStats({
  businessName,
  tier,
  weekStart,
}: {
  businessName: string;
  tier: string;
  weekStart: string;
}): Promise<WeekBookingStats> {
  const rangeStart = new Date(`${weekStart}T00:00:00Z`);
  const rangeEnd = new Date(`${addDaysISO(weekStart, 7)}T00:00:00Z`);
  const sends = await prisma.newsletterSend.findMany({
    where: { sentAt: { gte: rangeStart, lt: rangeEnd }, status: "sent" },
    select: { id: true, recipientCount: true },
  });
  const sendIds = sends.map((s) => s.id);
  const totalSends = sends.reduce((sum, s) => sum + s.recipientCount, 0);
  const opens = sendIds.length
    ? await prisma.newsletterRecipient.count({ where: { newsletterSendId: { in: sendIds }, openCount: { gt: 0 } } })
    : 0;
  const clicks = sendIds.length
    ? await prisma.linkClick.count({
        where: {
          newsletterRecipient: { newsletterSendId: { in: sendIds } },
          label: businessName,
          linkType: { in: SPONSOR_LINK_TYPES[tier] ?? [] },
        },
      })
    : 0;
  return { sends: totalSends, opens, clicks };
}

/** Creative locks 24h before the sponsor week starts. */
export function isCreativeLocked(weekStart: string): boolean {
  return Date.now() >= new Date(`${weekStart}T00:00:00Z`).getTime() - 24 * 3600 * 1000;
}

export interface PortalWeekBookingInput {
  id: string;
  tier: string;
  weekStart: string;
  status: string;
  amountCents: number;
  paidAt: Date | null;
  businessName: string;
  logoUrl: string;
  website: string | null;
  aboutText: string;
  chadWritesCopy: boolean;
  finalAdCopy: string | null;
}

/**
 * Portal-safe shape of a SponsorWeekBooking. Never includes stripeSessionId.
 * Pass stats when the caller wants them (the PATCH route skips them).
 */
export function shapePortalWeekBooking(
  b: PortalWeekBookingInput,
  stats?: WeekBookingStats
) {
  return {
    id: b.id,
    tier: b.tier,
    weekStart: b.weekStart,
    weekLabel: formatWeekRange(b.weekStart),
    status: b.status,
    amountCents: b.amountCents,
    paidAt: b.paidAt ? b.paidAt.toISOString() : null,
    businessName: b.businessName,
    logoUrl: b.logoUrl,
    website: b.website,
    aboutText: b.aboutText,
    chadWritesCopy: b.chadWritesCopy,
    finalAdCopy: b.finalAdCopy,
    creativeLocked: isCreativeLocked(b.weekStart),
    ...(stats ? { stats } : {}),
  };
}
