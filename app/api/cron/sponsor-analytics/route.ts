import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEmailClient } from "@/lib/email";

export const dynamic = "force-dynamic";

const PLACEMENT_LABELS: Record<string, string> = {
  spotlight:  "Community Partners listing",
  in_article: "Standard Ad",
  presenting: "Presenting Sponsorship",
};

// linkType values recorded in LinkClick
const BOOKING_LINK_TYPE: Record<string, string> = {
  in_article: "in_article_ad",
  presenting: "presenting_sponsor",
};

function analyticsEmailHtml({
  contactName,
  businessName,
  placements,
  impressions,
  portalUrl,
  dateStr,
}: {
  contactName: string;
  businessName: string;
  placements: { label: string; clicks: number }[];
  impressions: number;
  portalUrl: string;
  dateStr: string;
}): string {
  const totalClicks = placements.reduce((s, p) => s + p.clicks, 0);
  const placementSummary = placements.map((p) => p.label).join(" and ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

          <tr>
            <td style="background:#166534;padding:20px 32px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#86efac;">Sponsor Update</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">The Gist Decatur</p>
              <p style="margin:4px 0 0;font-size:13px;color:#bbf7d0;">${dateStr}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 20px;">
              <p style="margin:0 0 12px;font-size:17px;font-weight:700;color:#111827;">
                Your ${placementSummary} ran today!
              </p>
              <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
                Hi ${contactName}, <strong>${businessName}</strong> appeared in today&apos;s Gist Decatur newsletter. Here&apos;s how it performed so far:
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:50%;padding:16px 12px;background:#f0fdf4;border-radius:10px 0 0 10px;border:1px solid #bbf7d0;border-right:none;text-align:center;">
                    <p style="margin:0;font-size:32px;font-weight:700;color:#166534;">${impressions.toLocaleString()}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#4b5563;font-weight:600;">Impressions</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">readers saw your ad</p>
                  </td>
                  <td style="width:50%;padding:16px 12px;background:#f0fdf4;border-radius:0 10px 10px 0;border:1px solid #bbf7d0;border-left:none;text-align:center;">
                    <p style="margin:0;font-size:32px;font-weight:700;color:#166534;">${totalClicks.toLocaleString()}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#4b5563;font-weight:600;">Clicks</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">visits to your website</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${placements.length > 1 ? `
          <tr>
            <td style="padding:0 32px 20px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Click Breakdown</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${placements.map((p, i) => `
                <tr style="${i > 0 ? "border-top:1px solid #f3f4f6;" : ""}">
                  <td style="padding:10px 14px;font-size:13px;color:#374151;">${p.label}</td>
                  <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#166534;text-align:right;">${p.clicks} click${p.clicks !== 1 ? "s" : ""}</td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>` : ""}

          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;">
                See your full analytics history and manage your upcoming placements in your sponsor portal.
              </p>
              <a href="${portalUrl}" style="background:#166534;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">
                View My Sponsor Portal →
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">
                These numbers reflect opens and clicks captured so far — they may increase as more readers open today&apos;s newsletter throughout the day.
                To manage your sponsorships, visit your portal at ${portalUrl}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    new URL(req.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const emailClient = getEmailClient(settings);
  if (!emailClient) {
    return NextResponse.json({ error: "Email not configured." }, { status: 503 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const now = new Date();

  // Pick up sends from 3–4 hours ago. With an hourly cron, each send
  // falls in this window exactly once.
  const windowEnd   = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);

  const sends = await prisma.newsletterSend.findMany({
    where: { sentAt: { gte: windowStart, lte: windowEnd }, status: "sent" },
    select: { id: true, sentAt: true },
  });

  if (sends.length === 0) {
    return NextResponse.json({ ok: true, emailsSent: 0, message: "No sends in window." });
  }

  let totalEmailsSent = 0;

  for (const send of sends) {
    const sendDate = send.sentAt.toISOString().split("T")[0];
    const dateStr  = send.sentAt.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago",
    });

    // Impressions = unique openers of this send
    const impressions = await prisma.newsletterRecipient.count({
      where: { newsletterSendId: send.id, openCount: { gt: 0 } },
    });

    // Build a map of sponsorId → sponsor data + placements for this send
    const sponsorMap = new Map<string, {
      email: string;
      contactName: string;
      businessName: string;
      magicToken: string;
      placements: { label: string; clicks: number }[];
    }>();

    // ── 1. Spotlight appearances in this send ──────────────────────────────
    const spotlightAppearances = await prisma.newsletterSendSpotlight.findMany({
      where: { newsletterSendId: send.id },
      include: {
        spotlight: {
          select: {
            businessName: true,
            sponsor: {
              select: { id: true, email: true, contactName: true, businessName: true, magicToken: true },
            },
          },
        },
      },
    });

    for (const appearance of spotlightAppearances) {
      const sp = appearance.spotlight.sponsor;
      const bName = sp.businessName;
      if (!sponsorMap.has(sp.id)) {
        sponsorMap.set(sp.id, { email: sp.email, contactName: sp.contactName, businessName: bName, magicToken: sp.magicToken, placements: [] });
      }
      const clicks = await prisma.linkClick.count({
        where: {
          label: bName,
          linkType: "spotlight",
          newsletterRecipient: { newsletterSendId: send.id },
        },
      });
      sponsorMap.get(sp.id)!.placements.push({ label: PLACEMENT_LABELS.spotlight, clicks });
    }

    // ── 2. Approved ad bookings for the newsletter date ────────────────────
    const adBookings = await prisma.adBooking.findMany({
      where: { date: sendDate, status: "approved" },
      include: {
        sponsor: {
          select: { id: true, email: true, contactName: true, businessName: true, magicToken: true },
        },
      },
    });

    for (const booking of adBookings) {
      const sp = booking.sponsor;
      if (!sponsorMap.has(sp.id)) {
        sponsorMap.set(sp.id, { email: sp.email, contactName: sp.contactName, businessName: sp.businessName, magicToken: sp.magicToken, placements: [] });
      }
      const linkType = BOOKING_LINK_TYPE[booking.type] || booking.type;
      const clicks = await prisma.linkClick.count({
        where: {
          label: sp.businessName,
          linkType,
          newsletterRecipient: { newsletterSendId: send.id },
        },
      });
      sponsorMap.get(sp.id)!.placements.push({
        label: PLACEMENT_LABELS[booking.type] || booking.type,
        clicks,
      });
    }

    // ── 3. Send one email per sponsor ──────────────────────────────────────
    for (const sponsor of Array.from(sponsorMap.values())) {
      if (sponsor.placements.length === 0) continue;
      const portalUrl = `${appUrl}/sponsor/portal?token=${sponsor.magicToken}`;
      const placementSummary = sponsor.placements.map((p: { label: string; clicks: number }) => p.label).join(" & ");

      try {
        await emailClient.sendEmail({
          to: sponsor.email,
          subject: `Your ${placementSummary} results from today's Gist Decatur`,
          htmlBody: analyticsEmailHtml({
            contactName: sponsor.contactName,
            businessName: sponsor.businessName,
            placements: sponsor.placements,
            impressions,
            portalUrl,
            dateStr,
          }),
        });
        totalEmailsSent++;
      } catch (err) {
        console.error(`Failed to send analytics email to ${sponsor.email}:`, err);
      }
    }
  }

  return NextResponse.json({ ok: true, emailsSent: totalEmailsSent });
}
