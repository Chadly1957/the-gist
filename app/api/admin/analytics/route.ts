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

  const [recipients, sponsorClicks, spotlightAppearances] = await Promise.all([
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
    prisma.newsletterSendSpotlight.findMany({
      where: { newsletterSendId: { in: sendIds } },
      select: { newsletterSendId: true, spotlight: { select: { businessName: true } } },
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

    // Clicks map
    const sponsorMap = new Map<string, { type: string; label: string; clicks: number }>();
    for (const c of sponsorClicks) {
      if (c.newsletterRecipient.newsletterSendId !== send.id) continue;
      const key = `${c.linkType}:${c.label || "Unknown"}`;
      const existing = sponsorMap.get(key);
      if (existing) existing.clicks++;
      else sponsorMap.set(key, { type: c.linkType, label: c.label || "Unknown", clicks: 1 });
    }

    const sponsoredClicks = Array.from(sponsorMap.values()).sort((a, b) => b.clicks - a.clicks);

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

  return NextResponse.json({
    sends: stats,
    summary: {
      ...totals,
      avgOpenRate: totals.recipientCount > 0 ? totals.uniqueOpens / totals.recipientCount : 0,
      avgClickRate: totals.recipientCount > 0 ? totals.uniqueClicks / totals.recipientCount : 0,
    },
  });
}
