import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { deriveReaderState, ReaderState } from "@/lib/reader-segments";

export const dynamic = "force-dynamic";

// GET /api/admin/analytics/overview?days=30&q= — the Command Center:
// reader KPIs, acquisition, top links, reader-health segments, and the
// top readers table (clickable into Reader 360 detail). Workspace-scoped.
// Reads only; aggregates in memory over the period's recipients (~1k
// readers, a few thousand rows), which keeps the queries simple.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();
  const wid = workspace.id;

  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 30));
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const segment = (req.nextUrl.searchParams.get("segment") || "").trim();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [subscribers, recipients, linkClicks, deals, orders, referralSignups, referrerCodes] =
    await Promise.all([
      prisma.subscriber.findMany({
        where: { workspaceId: wid },
        select: {
          id: true,
          email: true,
          firstName: true,
          subscribedAt: true,
          active: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          referrer: true,
        },
      }),
      prisma.newsletterRecipient.findMany({
        where: {
          workspaceId: wid,
          newsletterSend: { sentAt: { gte: cutoff } },
        },
        select: {
          email: true,
          openedAt: true,
          openCount: true,
          clickedAt: true,
          clickCount: true,
          newsletterSendId: true,
          newsletterSend: { select: { subject: true, sentAt: true } },
        },
      }),
      prisma.linkClick.findMany({
        where: { workspaceId: wid, createdAt: { gte: cutoff } },
        select: { url: true, label: true, linkType: true },
      }),
      prisma.couponBookPurchase.findMany({
        where: { workspaceId: wid, active: true },
        select: { email: true, createdAt: true },
      }),
      prisma.productOrder.findMany({
        where: { workspaceId: wid, status: "paid" },
        select: { email: true },
      }),
      prisma.referralSignup.findMany({
        where: { workspaceId: wid },
        select: { newSubscriberId: true, referralCodeId: true },
      }),
      prisma.referralCode.findMany({
        where: { workspaceId: wid },
        select: { id: true, subscriberId: true },
      }),
    ]);

  const byEmail = new Map(subscribers.map((s) => [s.email.toLowerCase(), s]));
  const dealsSet = new Set(deals.map((d) => d.email.toLowerCase()));
  const orderSet = new Set(orders.map((o) => o.email.toLowerCase()));
  const referrerByCode = new Map(referrerCodes.map((c) => [c.id, c.subscriberId]));
  const referredIds = new Set(referralSignups.map((r) => r.newSubscriberId).filter(Boolean) as string[]);
  const referrerNameById = new Map(
    subscribers.map((s) => [s.id, s.firstName || s.email.split("@")[0]])
  );

  // Per-reader period stats, keyed by lowercase email.
  type Agg = { opens: number; openEvents: number; clicks: number; clickEvents: number; sends: number };
  const agg = new Map<string, Agg>();
  for (const r of recipients) {
    const key = r.email.toLowerCase();
    const a = agg.get(key) ?? { opens: 0, openEvents: 0, clicks: 0, clickEvents: 0, sends: 0 };
    a.sends += 1;
    if (r.openedAt) {
      a.opens += 1;
      a.openEvents += r.openCount;
    }
    if (r.clickedAt) {
      a.clicks += 1;
      a.clickEvents += r.clickCount;
    }
    agg.set(key, a);
  }

  // Lifetime opens per reader, for the Fading / At risk states.
  const lifetimeRecipients = await prisma.newsletterRecipient.groupBy({
    by: ["email"],
    where: { workspaceId: wid, openedAt: { not: null } },
    _count: { _all: true },
  });
  const lifetimeOpens = new Map(
    lifetimeRecipients.map((r) => [r.email.toLowerCase(), r._count._all])
  );

  const activeSubs = subscribers.filter((s) => s.active);
  const readers = activeSubs.map((s) => {
    const key = s.email.toLowerCase();
    const a = agg.get(key) ?? { opens: 0, openEvents: 0, clicks: 0, clickEvents: 0, sends: 0 };
    const state: ReaderState = deriveReaderState({
      subscribedAt: s.subscribedAt,
      opens30: a.opens,
      lifetimeOpens: lifetimeOpens.get(key) ?? 0,
    });
    const referredById = referralSignups.find((r) => r.newSubscriberId === s.id)?.referralCodeId;
    const referrerSubId = referredById ? referrerByCode.get(referredById) : undefined;
    return {
      id: s.id,
      email: s.email,
      firstName: s.firstName,
      subscribedAt: s.subscribedAt,
      opens: a.opens,
      openEvents: a.openEvents,
      clicks: a.clicks,
      clickEvents: a.clickEvents,
      sends: a.sends,
      state,
      dealsBuyer: dealsSet.has(key),
      hasOrder: orderSet.has(key),
      referred: referredIds.has(s.id),
      referredBy: referrerSubId ? referrerNameById.get(referrerSubId) ?? null : null,
      utmSource: s.utmSource,
      utmMedium: s.utmMedium,
      utmCampaign: s.utmCampaign,
      referrer: s.referrer,
    };
  });

  // Both filters apply BEFORE the top-50 cut. Filtering after the cut was
  // the bug: the top 50 by opens are almost all Highly engaged, so every
  // other segment came back blank.
  let filtered = q
    ? readers.filter(
        (r) =>
          r.email.toLowerCase().includes(q) ||
          (r.firstName ?? "").toLowerCase().includes(q)
      )
    : readers;
  if (segment) filtered = filtered.filter((r) => r.state === segment);
  const topReaders = [...filtered]
    .sort((a, b) => b.opens - a.opens || b.clickEvents - a.clickEvents)
    .slice(0, 50);

  const segments = new Map<string, number>();
  for (const r of readers) segments.set(r.state, (segments.get(r.state) ?? 0) + 1);

  const acquisition = new Map<string, number>();
  for (const s of activeSubs) {
    const label = s.utmSource
      ? `Ad · ${s.utmSource}${s.utmCampaign ? ` / ${s.utmCampaign}` : ""}`
      : referredIds.has(s.id)
        ? "Referred"
        : "Unknown (before UTM capture)";
    acquisition.set(label, (acquisition.get(label) ?? 0) + 1);
  }

  const linkAgg = new Map<string, { url: string; label: string; type: string; clicks: number }>();
  for (const c of linkClicks) {
    const key = c.url;
    const e = linkAgg.get(key) ?? { url: c.url, label: c.label ?? c.url, type: c.linkType, clicks: 0 };
    e.clicks += 1;
    linkAgg.set(key, e);
  }
  const topLinks = Array.from(linkAgg.values()).sort((a, b) => b.clicks - a.clicks).slice(0, 10);

  // Per-send trend for the period, newest first.
  const sendAgg = new Map<string, { subject: string; sentAt: string; opens: number; clicks: number; recipients: number }>();
  for (const r of recipients) {
    const e = sendAgg.get(r.newsletterSendId) ?? {
      subject: r.newsletterSend.subject,
      sentAt: r.newsletterSend.sentAt.toISOString(),
      opens: 0,
      clicks: 0,
      recipients: 0,
    };
    e.recipients += 1;
    if (r.openedAt) e.opens += 1;
    if (r.clickedAt) e.clicks += 1;
    sendAgg.set(r.newsletterSendId, e);
  }
  const trend = Array.from(sendAgg.values())
    .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))
    .slice(0, 20);

  return NextResponse.json({
    days,
    totals: {
      activeReaders: activeSubs.length,
      newInPeriod: activeSubs.filter((s) => s.subscribedAt >= cutoff).length,
      avgOpensPerReader: readers.length
        ? readers.reduce((sum, r) => sum + r.opens, 0) / readers.length
        : 0,
      totalClickEvents: readers.reduce((sum, r) => sum + r.clickEvents, 0),
      dealsBuyers: dealsSet.size,
      referredReaders: referredIds.size,
    },
    segments: Object.fromEntries(segments),
    acquisition: Array.from(acquisition.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    topLinks,
    trend,
    topReaders,
    readerCount: filtered.length,
  });
}
