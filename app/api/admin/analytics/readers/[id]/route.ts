import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { deriveReaderState } from "@/lib/reader-segments";

export const dynamic = "force-dynamic";

// GET /api/admin/analytics/readers/[id]?days=30 — Reader 360 detail for one
// subscriber: period + lifetime engagement, purchases, referrals, click
// breakdown, and a recent activity timeline. The id is the subscriber id;
// all engagement is matched by email, since older recipient rows predate
// the subscriber link.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getWorkspace();
  const wid = workspace.id;
  const { id } = await params;

  const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get("days")) || 30));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const subscriber = await prisma.subscriber.findFirst({
    where: { id, workspaceId: wid },
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
  });
  if (!subscriber) return NextResponse.json({ error: "Reader not found." }, { status: 404 });
  const email = subscriber.email;

  const [recipients, deals, orders, myCode, referredBySignup] = await Promise.all([
    prisma.newsletterRecipient.findMany({
      where: { workspaceId: wid, email },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        newsletterSendId: true,
        openedAt: true,
        openCount: true,
        clickedAt: true,
        clickCount: true,
        unsubscribedAt: true,
        createdAt: true,
        newsletterSend: { select: { subject: true, sentAt: true } },
      },
    }),
    prisma.couponBookPurchase.findMany({
      where: { workspaceId: wid, email, active: true },
      select: { id: true, createdAt: true, isLifetime: true },
    }),
    prisma.productOrder.findMany({
      where: { workspaceId: wid, email, status: "paid" },
      select: { id: true, amountCents: true, paidAt: true, product: { select: { name: true } } },
    }),
    prisma.referralCode.findFirst({
      where: { workspaceId: wid, subscriberId: id },
      select: { id: true, code: true },
    }),
    prisma.referralSignup.findFirst({
      where: { workspaceId: wid, newSubscriberId: id },
      select: { referralCode: { select: { subscriberId: true } } },
    }),
  ]);

  const recipientIds = recipients.map((r) => r.id);
  const [linkClicks, referredSignups, referrer] = await Promise.all([
    recipientIds.length
      ? prisma.linkClick.findMany({
          where: { workspaceId: wid, newsletterRecipientId: { in: recipientIds } },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { url: true, label: true, linkType: true, createdAt: true },
        })
      : Promise.resolve([]),
    myCode
      ? prisma.referralSignup.findMany({
          where: { workspaceId: wid, referralCodeId: myCode.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { newSubscriberId: true, createdAt: true },
        })
      : Promise.resolve([]),
    referredBySignup
      ? prisma.subscriber.findFirst({
          where: { id: referredBySignup.referralCode.subscriberId, workspaceId: wid },
          select: { firstName: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  const referredEmails = referredSignups.length
    ? await prisma.subscriber.findMany({
        where: {
          workspaceId: wid,
          id: { in: referredSignups.map((r) => r.newSubscriberId).filter(Boolean) as string[] },
        },
        select: { id: true, email: true, firstName: true },
      })
    : [];
  const referredByEmail = new Map(referredEmails.map((s) => [s.id, s]));

  const periodRecipients = recipients.filter((r) => r.newsletterSend.sentAt >= cutoff);
  const opens = periodRecipients.filter((r) => r.openedAt).length;
  const openEvents = periodRecipients.reduce((sum, r) => sum + r.openCount, 0);
  const clicks = periodRecipients.filter((r) => r.clickedAt).length;
  const clickEvents = periodRecipients.reduce((sum, r) => sum + r.clickCount, 0);
  const lifetimeOpens = recipients.filter((r) => r.openedAt).length;

  const clickByType = new Map<string, number>();
  for (const c of linkClicks) clickByType.set(c.linkType, (clickByType.get(c.linkType) ?? 0) + 1);

  const timeline = [
    ...recipients.slice(0, 30).map((r) => ({
      kind: r.openedAt ? "opened" : "sent",
      at: (r.openedAt ?? r.newsletterSend.sentAt).toISOString(),
      label: r.newsletterSend.subject,
      detail: r.clickedAt ? `Opened · clicked ${r.clickCount} time${r.clickCount === 1 ? "" : "s"}` : r.openedAt ? "Opened" : "Delivered, not opened",
    })),
    ...linkClicks.slice(0, 30).map((c) => ({
      kind: "clicked",
      at: c.createdAt.toISOString(),
      label: c.label ?? c.url,
      detail: c.linkType,
    })),
    ...deals.map((d) => ({
      kind: "purchased",
      at: d.createdAt.toISOString(),
      label: "Gist Deals book",
      detail: d.isLifetime ? "$15 · lifetime" : "$15",
    })),
    ...orders.map((o) => ({
      kind: "purchased",
      at: (o.paidAt ?? new Date(0)).toISOString(),
      label: o.product.name,
      detail: `$${(o.amountCents / 100).toFixed(2)}`,
    })),
    ...referredSignups.map((r) => ({
      kind: "referred",
      at: r.createdAt.toISOString(),
      label: `Referred ${referredByEmail.get(r.newSubscriberId ?? "")?.firstName ?? referredByEmail.get(r.newSubscriberId ?? "")?.email ?? "a reader"}`,
      detail: "via your referral link",
    })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 40);

  return NextResponse.json({
    reader: {
      id: subscriber.id,
      email: subscriber.email,
      firstName: subscriber.firstName,
      subscribedAt: subscriber.subscribedAt,
      active: subscriber.active,
      state: deriveReaderState({
        subscribedAt: subscriber.subscribedAt,
        opens30: opens,
        lifetimeOpens,
      }),
      acquisition: subscriber.utmSource
        ? { kind: "ad", source: subscriber.utmSource, medium: subscriber.utmMedium, campaign: subscriber.utmCampaign }
        : referrer
          ? { kind: "referral", source: referrer.firstName ?? referrer.email }
          : subscriber.referrer
            ? { kind: "link", source: subscriber.referrer }
            : { kind: "unknown", source: null },
    },
    stats: {
      days,
      opens,
      openEvents,
      clicks,
      clickEvents,
      sendsReceived: periodRecipients.length,
      lifetimeOpens,
      lifetimeClickEvents: recipients.reduce((sum, r) => sum + r.clickCount, 0),
      clickByType: Object.fromEntries(clickByType),
    },
    purchases: {
      deals,
      orders: orders.map((o) => ({
        id: o.id,
        name: o.product.name,
        amountCents: o.amountCents,
        paidAt: o.paidAt,
      })),
    },
    referrals: {
      code: myCode?.code ?? null,
      referredCount: referredSignups.length,
      referred: referredSignups.map((r) => ({
        id: r.newSubscriberId,
        email: referredByEmail.get(r.newSubscriberId ?? "")?.email ?? null,
        firstName: referredByEmail.get(r.newSubscriberId ?? "")?.firstName ?? null,
        at: r.createdAt,
      })),
    },
    recentSends: recipients.slice(0, 20).map((r) => ({
      id: r.newsletterSendId,
      subject: r.newsletterSend.subject,
      sentAt: r.newsletterSend.sentAt,
      opened: !!r.openedAt,
      openCount: r.openCount,
      clicked: !!r.clickedAt,
      clickCount: r.clickCount,
    })),
    timeline,
  });
}
