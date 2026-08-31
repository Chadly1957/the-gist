import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEmailClient } from "@/lib/email";

export const dynamic = "force-dynamic";

function digestHtml(data: {
  date: string;
  activeSubscribers: number;
  newSubscribers: number;
  send: {
    subject: string;
    recipientCount: number;
    uniqueOpens: number;
    openRate: number;
    uniqueClicks: number;
    clickRate: number;
    unsubscribes: number;
    sponsoredClicks: { label: string; type: string; clicks: number }[];
  } | null;
}): string {
  const SPONSOR_TYPE_LABELS: Record<string, string> = {
    spotlight: "Community Partner",
    presenting_sponsor: "Presenting",
    in_article_ad: "Standard Ad",
  };

  const sendSection = data.send
    ? `
      <tr>
        <td style="padding: 24px 32px 0;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">
            Today's Newsletter
          </p>
          <p style="margin:0 0 6px;font-size:13px;color:#374151;font-style:italic;">"${data.send.subject}"</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
            <tr>
              <td style="padding:10px 12px;background:#f9fafb;border-radius:8px 0 0 8px;border:1px solid #e5e7eb;border-right:none;text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:700;color:#146763;">${(data.send.openRate * 100).toFixed(1)}%</p>
                <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Open rate</p>
                <p style="margin:1px 0 0;font-size:10px;color:#9ca3af;">${data.send.uniqueOpens} of ${data.send.recipientCount}</p>
              </td>
              <td style="padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-left:none;border-right:none;text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:700;color:#146763;">${(data.send.clickRate * 100).toFixed(1)}%</p>
                <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Click rate</p>
                <p style="margin:1px 0 0;font-size:10px;color:#9ca3af;">${data.send.uniqueClicks} unique</p>
              </td>
              <td style="padding:10px 12px;background:#f9fafb;border-radius:0 8px 8px 0;border:1px solid #e5e7eb;border-left:none;text-align:center;">
                <p style="margin:0;font-size:22px;font-weight:700;color:${data.send.unsubscribes > 0 ? "#dc2626" : "#146763"};">${data.send.unsubscribes}</p>
                <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Unsubs</p>
              </td>
            </tr>
          </table>
          ${data.send.sponsoredClicks.length > 0 ? `
          <p style="margin:20px 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">
            Sponsor Clicks
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${data.send.sponsoredClicks.map((s) => `
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
                <span style="font-size:13px;color:#374151;font-weight:600;">${s.label}</span>
                <span style="font-size:11px;color:#9ca3af;margin-left:6px;">${SPONSOR_TYPE_LABELS[s.type] || s.type}</span>
              </td>
              <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;text-align:right;">
                <span style="font-size:13px;font-weight:700;color:#146763;">${s.clicks} click${s.clicks !== 1 ? "s" : ""}</span>
              </td>
            </tr>`).join("")}
          </table>` : ""}
        </td>
      </tr>`
    : `
      <tr>
        <td style="padding: 24px 32px 0;">
          <p style="margin:0;font-size:13px;color:#9ca3af;">No newsletter was sent today.</p>
        </td>
      </tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background:#146763;padding:20px 32px;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8fe5c1;">Daily Digest</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;">The Gist Decatur</p>
              <p style="margin:4px 0 0;font-size:13px;color:#c4eedb;">${data.date}</p>
            </td>
          </tr>

          <!-- Subscribers -->
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">
                Subscribers
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:10px 12px;background:#f9fafb;border-radius:8px 0 0 8px;border:1px solid #e5e7eb;border-right:none;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#146763;">${data.activeSubscribers.toLocaleString()}</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Active</p>
                  </td>
                  <td style="padding:10px 12px;background:#f9fafb;border-radius:0 8px 8px 0;border:1px solid #e5e7eb;border-left:none;text-align:center;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:${data.newSubscribers > 0 ? "#146763" : "#6b7280"};">+${data.newSubscribers}</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">New today</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${sendSection}

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                This is your automated daily digest from The Gist Decatur admin.
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

  const resend = getEmailClient(settings);
  if (!resend) {
    return NextResponse.json({ error: "SMTP not configured." }, { status: 503 });
  }

  const adminUser = await prisma.adminUser.findFirst();
  if (!adminUser) {
    return NextResponse.json({ error: "No admin user found." }, { status: 500 });
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [activeSubscribers, newSubscribers, todaySend] = await Promise.all([
    prisma.subscriber.count({ where: { active: true } }),
    prisma.subscriber.count({ where: { subscribedAt: { gte: startOfToday } } }),
    prisma.newsletterSend.findFirst({
      where: { sentAt: { gte: startOfToday }, status: "sent" },
      orderBy: { sentAt: "desc" },
    }),
  ]);

  let sendStats = null;
  if (todaySend) {
    const [recipients, sponsorClicks] = await Promise.all([
      prisma.newsletterRecipient.findMany({
        where: { newsletterSendId: todaySend.id },
        select: { openCount: true, clickCount: true, unsubscribedAt: true },
      }),
      prisma.linkClick.findMany({
        where: {
          linkType: { in: ["spotlight", "presenting_sponsor", "in_article_ad"] },
          newsletterRecipient: { newsletterSendId: todaySend.id },
        },
        select: { linkType: true, label: true },
      }),
    ]);

    const uniqueOpens = recipients.filter((r) => r.openCount > 0).length;
    const uniqueClicks = recipients.filter((r) => r.clickCount > 0).length;
    const unsubscribes = recipients.filter((r) => r.unsubscribedAt).length;
    const recipientCount = todaySend.recipientCount;

    const sponsorMap = new Map<string, { label: string; type: string; clicks: number }>();
    for (const c of sponsorClicks) {
      const key = `${c.linkType}:${c.label}`;
      const existing = sponsorMap.get(key);
      if (existing) existing.clicks++;
      else sponsorMap.set(key, { label: c.label || "Unknown", type: c.linkType, clicks: 1 });
    }

    sendStats = {
      subject: todaySend.subject,
      recipientCount,
      uniqueOpens,
      openRate: recipientCount > 0 ? uniqueOpens / recipientCount : 0,
      uniqueClicks,
      clickRate: recipientCount > 0 ? uniqueClicks / recipientCount : 0,
      unsubscribes,
      sponsoredClicks: Array.from(sponsorMap.values()).sort((a, b) => b.clicks - a.clicks),
    };
  }

  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });

  const html = digestHtml({ date, activeSubscribers, newSubscribers, send: sendStats });

  const result = await resend.sendEmail({
    to: adminUser.email,
    subject: `Daily Digest – ${date}`,
    htmlBody: html,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    to: adminUser.email,
    newSubscribers,
    activeSubscribers,
    sendTracked: !!todaySend,
  });
}
