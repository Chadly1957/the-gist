import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SPONSOR_TYPES = ["spotlight", "presenting_sponsor", "in_article_ad"];

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sends = await prisma.newsletterSend.findMany({
    where: { status: { in: ["sent", "failed"] } },
    orderBy: { sentAt: "desc" },
    take: 30,
    select: { id: true, subject: true, sentAt: true, recipientCount: true, status: true },
  });

  const sendIds = sends.map((s) => s.id);

  const sendDates = sends.map((s) => s.sentAt.toISOString().split("T")[0]);

  const [recipients, sponsorClicks, articleClicks, spotlightAppearances, adBookings] = await Promise.all([
    prisma.newsletterRecipient.findMany({
      where: { newsletterSendId: { in: sendIds } },
      select: { newsletterSendId: true, openCount: true, clickCount: true, unsubscribedAt: true },
    }),
    prisma.linkClick.findMany({
      where: {
        linkType: { in: SPONSOR_TYPES },
        newsletterRecipient: { newsletterSendId: { in: sendIds } },
      },
      select: {
        linkType: true,
        label: true,
        newsletterRecipient: { select: { newsletterSendId: true } },
      },
    }),
    prisma.linkClick.findMany({
      where: {
        linkType: "article",
        newsletterRecipient: { newsletterSendId: { in: sendIds } },
      },
      select: {
        label: true,
        url: true,
        newsletterRecipient: { select: { newsletterSendId: true } },
      },
    }),
    prisma.newsletterSendSpotlight.findMany({
      where: { newsletterSendId: { in: sendIds } },
      select: { newsletterSendId: true, spotlight: { select: { businessName: true } } },
    }),
    prisma.adBooking.findMany({
      where: { status: "approved", date: { in: sendDates } },
      select: { date: true, type: true, sponsor: { select: { businessName: true } } },
    }),
  ]);

  // Build map: sendId → spotlight business names that appeared
  const spotlightsBySend = new Map<string, string[]>();
  for (const a of spotlightAppearances) {
    const list = spotlightsBySend.get(a.newsletterSendId) ?? [];
    list.push(a.spotlight.businessName);
    spotlightsBySend.set(a.newsletterSendId, list);
  }

  const stats = sends.map((send) => {
    const recips = recipients.filter((r) => r.newsletterSendId === send.id);
    const tracked = recips.length > 0;
    const recipientCount = send.recipientCount;
    const uniqueOpens = recips.filter((r) => r.openCount > 0).length;
    const uniqueClicks = recips.filter((r) => r.clickCount > 0).length;
    const totalClicks = recips.reduce((sum, r) => sum + r.clickCount, 0);
    const unsubscribes = recips.filter((r) => r.unsubscribedAt).length;

    // Sponsor clicks map
    const sponsorMap = new Map<string, { type: string; label: string; clicks: number }>();
    for (const c of sponsorClicks) {
      if (c.newsletterRecipient.newsletterSendId !== send.id) continue;
      const key = `${c.linkType}:${c.label || "Unknown"}`;
      const existing = sponsorMap.get(key);
      if (existing) existing.clicks++;
      else sponsorMap.set(key, { type: c.linkType, label: c.label || "Unknown", clicks: 1 });
    }

    const sponsoredClicks = Array.from(sponsorMap.values()).sort((a, b) => b.clicks - a.clicks);

    // Article clicks map
    const articleMap = new Map<string, { label: string; url: string; clicks: number }>();
    for (const c of articleClicks) {
      if (c.newsletterRecipient.newsletterSendId !== send.id) continue;
      const key = c.url || c.label || "Unknown";
      const existing = articleMap.get(key);
      if (existing) existing.clicks++;
      else articleMap.set(key, { label: c.label || c.url || "Unknown", url: c.url || "", clicks: 1 });
    }

    const articleClickList = Array.from(articleMap.values()).sort((a, b) => b.clicks - a.clicks);

    return {
      id: send.id,
      subject: send.subject,
      sentAt: send.sentAt,
      status: send.status,
      tracked,
      recipientCount,
      uniqueOpens,
      openRate: recipientCount > 0 ? uniqueOpens / recipientCount : 0,
      uniqueClicks,
      clickRate: recipientCount > 0 ? uniqueClicks / recipientCount : 0,
      totalClicks,
      unsubscribes,
      // impressions = uniqueOpens; every opener saw all sponsors in that send
      sponsoredClicks: sponsoredClicks.map((s) => ({ ...s, impressions: uniqueOpens })),
      articleClicks: articleClickList,
      spotlightNames: spotlightsBySend.get(send.id) ?? [],
    };
  });

  const trackedStats = stats.filter((s) => s.tracked);
  const totals = trackedStats.reduce(
    (acc, s) => ({
      recipientCount: acc.recipientCount + s.recipientCount,
      uniqueOpens: acc.uniqueOpens + s.uniqueOpens,
      uniqueClicks: acc.uniqueClicks + s.uniqueClicks,
      unsubscribes: acc.unsubscribes + s.unsubscribes,
      sponsoredClicks: acc.sponsoredClicks + s.sponsoredClicks.reduce((sum, sc) => sum + sc.clicks, 0),
      sponsoredImpressions:
        acc.sponsoredImpressions +
        (s.sponsoredClicks.length > 0 ? s.uniqueOpens * s.sponsoredClicks.length : 0),
    }),
    { recipientCount: 0, uniqueOpens: 0, uniqueClicks: 0, unsubscribes: 0, sponsoredClicks: 0, sponsoredImpressions: 0 }
  );

  // Build appearance counts: "type::label" → Set<sendId>
  const dateToSendId = new Map<string, string>();
  for (const s of sends) {
    dateToSendId.set(s.sentAt.toISOString().split("T")[0], s.id);
  }
  // booking.type → linkType key
  const BOOKING_LINK_TYPE: Record<string, string> = {
    in_article: "in_article_ad",
    presenting: "presenting_sponsor",
  };
  const issuesBySponsor = new Map<string, Set<string>>();

  for (const a of spotlightAppearances) {
    const key = `spotlight::${a.spotlight.businessName}`;
    if (!issuesBySponsor.has(key)) issuesBySponsor.set(key, new Set());
    issuesBySponsor.get(key)!.add(a.newsletterSendId);
  }
  for (const b of adBookings) {
    const sendId = dateToSendId.get(b.date);
    if (!sendId) continue;
    const linkType = BOOKING_LINK_TYPE[b.type] ?? b.type;
    const key = `${linkType}::${b.sponsor.businessName}`;
    if (!issuesBySponsor.has(key)) issuesBySponsor.set(key, new Set());
    issuesBySponsor.get(key)!.add(sendId);
  }

  // Aggregate sponsor performance across all tracked sends
  const byType = new Map<string, { impressions: number; clicks: number }>();
  const bySponsor = new Map<string, { type: string; label: string; impressions: number; clicks: number }>();

  for (const send of trackedStats) {
    for (const sc of send.sponsoredClicks) {
      const te = byType.get(sc.type) ?? { impressions: 0, clicks: 0 };
      te.impressions += sc.impressions;
      te.clicks += sc.clicks;
      byType.set(sc.type, te);

      const key = `${sc.type}::${sc.label}`;
      const se = bySponsor.get(key) ?? { type: sc.type, label: sc.label, impressions: 0, clicks: 0 };
      se.impressions += sc.impressions;
      se.clicks += sc.clicks;
      bySponsor.set(key, se);
    }
  }

  const sponsorBreakdown = {
    byType: Object.fromEntries(byType),
    topSponsors: Array.from(bySponsor.entries())
      .map(([key, s]) => ({ ...s, issues: issuesBySponsor.get(key)?.size ?? 0 }))
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 25),
  };

  return NextResponse.json({
    sends: stats,
    summary: {
      ...totals,
      avgOpenRate: totals.recipientCount > 0 ? totals.uniqueOpens / totals.recipientCount : 0,
      avgClickRate: totals.recipientCount > 0 ? totals.uniqueClicks / totals.recipientCount : 0,
    },
    sponsorBreakdown,
  });
}
