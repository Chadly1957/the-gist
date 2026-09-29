import { basePrisma } from "@/lib/db-base";
import { withWorkspace, getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addDaysISO, formatWeekRange } from "@/lib/sponsor-weeks";
import {
  sendCommunityBoardUpgradeNudge,
  sendRenewalNudge,
  sendWeekResults,
} from "@/lib/sponsor-week-email";

export const dynamic = "force-dynamic";

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SPONSOR_LINK_TYPES: Record<string, string[]> = {
  presenting: ["presenting_sponsor"],
  standard: ["in_article_ad"],
};

async function runWorkspace() {
  const workspace = await getWorkspace();
  const appUrl = await getWorkspaceUrl();
  const now = new Date();
  let resultsSent = 0;
  let renewalsSent = 0;
  let upgradesSent = 0;

  // -- 1. Results emails: Monday after the sponsor week ends ----------------
  const dueResults = await prisma.sponsorWeekBooking.findMany({
    where: { status: "paid", resultsSentAt: null },
    include: { week: { select: { weekStart: true } } },
  });

  for (const booking of dueResults) {
    // The week is over once we reach the next Monday.
    if (addDaysISO(booking.week.weekStart, 7) > toISODate(now)) continue;

    const rangeStart = new Date(`${booking.week.weekStart}T00:00:00Z`);
    const rangeEnd = new Date(`${addDaysISO(booking.week.weekStart, 7)}T00:00:00Z`);
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
            label: booking.businessName,
            linkType: { in: SPONSOR_LINK_TYPES[booking.tier] ?? [] },
          },
        })
      : 0;

    const tierLabel = booking.tier === "presenting" ? "Presenting Sponsor" : "Standard Sponsor";
    try {
      await sendWeekResults({
        to: booking.email,
        contactName: booking.contactName,
        businessName: booking.businessName,
        tierLabel,
        weekLabel: formatWeekRange(booking.week.weekStart),
        sends: totalSends,
        opens,
        clicks,
        rebookUrl: `${appUrl}/sponsor/apply?rebook=${booking.rebookToken}`,
      });
      resultsSent++;
    } catch (err) {
      console.error(`Week results email failed for booking ${booking.id}:`, err);
      continue;
    }
    await prisma.sponsorWeekBooking.update({
      where: { id: booking.id },
      data: { resultsSentAt: now, status: "completed" },
    });
  }

  // -- 2. Renewal nudges: ~2 days after the results email ------------------
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const dueRenewals = await prisma.sponsorWeekBooking.findMany({
    where: { status: "completed", renewalSentAt: null, resultsSentAt: { lte: twoDaysAgo } },
    include: { week: { select: { weekStart: true } } },
  });

  for (const booking of dueRenewals) {
    const rangeStart = new Date(`${booking.week.weekStart}T00:00:00Z`);
    const rangeEnd = new Date(`${addDaysISO(booking.week.weekStart, 7)}T00:00:00Z`);
    const sends = await prisma.newsletterSend.findMany({
      where: { sentAt: { gte: rangeStart, lt: rangeEnd }, status: "sent" },
      select: { id: true },
    });
    const sendIds = sends.map((s) => s.id);
    const clicks = sendIds.length
      ? await prisma.linkClick.count({
          where: {
            newsletterRecipient: { newsletterSendId: { in: sendIds } },
            label: booking.businessName,
            linkType: { in: SPONSOR_LINK_TYPES[booking.tier] ?? [] },
          },
        })
      : 0;

    const tierLabel = booking.tier === "presenting" ? "Presenting Sponsor" : "Standard Sponsor";
    try {
      await sendRenewalNudge({
        to: booking.email,
        contactName: booking.contactName,
        businessName: booking.businessName,
        tierLabel,
        weekLabel: formatWeekRange(booking.week.weekStart),
        clicks,
        rebookUrl: `${appUrl}/sponsor/apply?rebook=${booking.rebookToken}`,
      });
      renewalsSent++;
    } catch (err) {
      console.error(`Renewal email failed for booking ${booking.id}:`, err);
      continue;
    }
    await prisma.sponsorWeekBooking.update({ where: { id: booking.id }, data: { renewalSentAt: now } });
  }

  // -- 3. Community Board upgrade nudges: ~4 weeks after signup ------------
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  // Only listings created since the rebuild; older ones never opted into this.
  const rebuildDate = new Date("2026-09-29T00:00:00Z");
  const dueUpgrades = await prisma.spotlightListing.findMany({
    where: {
      status: "active",
      upgradeNudgeSentAt: null,
      createdAt: { lte: fourWeeksAgo, gte: rebuildDate },
    },
    include: { sponsor: { select: { email: true, contactName: true } } },
  });

  for (const listing of dueUpgrades) {
    try {
      await sendCommunityBoardUpgradeNudge({
        to: listing.sponsor.email,
        contactName: listing.sponsor.contactName,
        businessName: listing.businessName,
        appearances: listing.shownCount,
        upgradeUrl: `${appUrl}/sponsor`,
      });
      upgradesSent++;
    } catch (err) {
      console.error(`Upgrade nudge failed for listing ${listing.id}:`, err);
      continue;
    }
    await prisma.spotlightListing.update({ where: { id: listing.id }, data: { upgradeNudgeSentAt: now } });
  }

  return NextResponse.json({ ok: true, resultsSent, renewalsSent, upgradesSent });
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") || new URL(req.url).searchParams.get("secret");
  if (!secret || provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaces = await basePrisma.workspace.findMany();
  const results = [];
  for (const workspace of workspaces) {
    try {
      const response = await withWorkspace(workspace, () => runWorkspace());
      results.push({ workspace: workspace.slug, status: response.status, result: await response.json() });
    } catch (error) {
      console.error("Workspace sponsor weekly failed", workspace.id, error);
      results.push({ workspace: workspace.slug, status: 500 });
    }
  }
  return NextResponse.json({ results }, { status: results.some((r) => r.status === 500) ? 500 : 200 });
}
