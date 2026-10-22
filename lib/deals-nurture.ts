import { prisma } from "@/lib/db";
import { getEmailClient, htmlToText } from "@/lib/email";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { escapeHtml } from "@/lib/html";

// Post-signup Deals nurture sequence. New subscribers see the one-time offer
// on the thank-you page; anyone who doesn't buy enters this 4-touch email
// sequence (2h / 24h / 72h / day 5). Stops when they buy the book, opt out of
// deal reminders, or unsubscribe. Driven hourly by /api/cron/deals-nurture.
//
// The offer is deliberately simple: the book, $15 once, backed by the
// One-Deal Promise. No bundles, no bonus stack, no manufactured urgency.
// Touch 3's urgency is real: it's the last email about the book.

// touch -> hours after subscribedAt before it's due, and minimum hours since
// the previous touch was sent (keeps pacing sane for older subscribers who
// enroll mid-sequence, e.g. the recent ad cohort).
const SCHEDULE = [
  { touch: 1, delayHours: 2, minGapHours: 0 },
  { touch: 2, delayHours: 24, minGapHours: 20 },
  { touch: 3, delayHours: 72, minGapHours: 40 },
  { touch: 4, delayHours: 120, minGapHours: 40 },
];
const ENROLL_WINDOW_HOURS = 24 * 8;

function dealsLink(appUrl: string, touch: number, email: string): string {
  return `${appUrl}/deals?src=nurture${touch}&email=${encodeURIComponent(email)}`;
}

function remindersOptOutLink(appUrl: string, workspaceId: string, email: string): string {
  return `${appUrl}/api/nurture-optout?wid=${encodeURIComponent(workspaceId)}&email=${encodeURIComponent(email)}`;
}

function footerHtml(opts: {
  newsletterName: string;
  appUrl: string;
  workspaceId: string;
  email: string;
  unsubUrl: string;
}): string {
  return `
    <div style="border-top: 1px solid #e5e7eb; margin: 24px 0 0; padding-top: 16px;">
      <p style="color: #9ca3af; font-size: 12px; line-height: 1.6; margin: 0;">
        You&apos;re getting this because you recently joined ${escapeHtml(opts.newsletterName)}.<br>
        <a href="${remindersOptOutLink(opts.appUrl, opts.workspaceId, opts.email)}" style="color: #9ca3af;">Stop deal reminders</a>
        &nbsp;&middot;&nbsp;
        <a href="${opts.unsubUrl}" style="color: #9ca3af;">Unsubscribe from everything</a>
      </p>
    </div>`;
}

function ctaHtml(url: string, label: string): string {
  return `
    <p style="margin: 20px 0;">
      <a href="${url}" style="background: #15803d; color: #ffffff; padding: 13px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block;">${label}</a>
    </p>`;
}

function guaranteeHtml(): string {
  return `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 16px; margin: 16px 0;">
      <p style="color: #14532d; font-size: 14px; font-weight: bold; margin: 0 0 4px;">The One-Deal Promise</p>
      <p style="color: #166534; font-size: 13px; line-height: 1.6; margin: 0;">
        If you don&apos;t save at least $15 with the book in your first 60 days, just email me and I&apos;ll refund every cent. You keep the book.
      </p>
    </div>`;
}

interface TouchContent {
  subject: string;
  html: string;
}

function buildTouch(
  touch: number,
  opts: {
    area: string;
    newsletterName: string;
    link: string;
  }
): TouchContent {
  const greeting = "Hey there!";
  const wrap = (inner: string) => `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      ${inner}
    </div>`;
  const sign = `<p style="color: #4b5563; font-size: 14px; line-height: 1.6;">- Chad</p>`;
  const p = (inner: string) =>
    `<p style="color: #4b5563; font-size: 14px; line-height: 1.6;">${inner}</p>`;

  if (touch === 1) {
    return {
      subject: "Quick reminder: The Gist Deals",
      html: wrap(`
        ${p(greeting)}
        ${p(`You joined <strong style="color: #111827;">${escapeHtml(opts.newsletterName)}</strong> a couple hours ago. Did you see the offer on the thank-you page?`)}
        ${p(`I built <strong style="color: #111827;">The Gist Deals</strong>: a digital book of real discounts from local ${escapeHtml(opts.area)} businesses, right on your phone. Weekly grocery deals, local coupons with QR codes, and the 10 best deals hand-picked every Monday.`)}
        ${p(`It&apos;s <strong style="color: #111827;">$15 once, yours for life</strong>. One grocery run usually covers it.`)}
        ${ctaHtml(opts.link, "Get the Book, $15 once")}
        ${p(`You only see that offer right after you join, so I wanted to make sure you saw it.`)}
        ${sign}`),
    };
  }

  if (touch === 2) {
    return {
      subject: "Is the Deals book worth $15?",
      html: wrap(`
        ${p(greeting)}
        ${p(`Fair question. Here&apos;s how I think about it:`)}
        ${p(`The book has <strong style="color: #111827;">weekly grocery deals</strong> from stores like Aldi, Kroger, and Dollar General, <strong style="color: #111827;">real coupons from local ${escapeHtml(opts.area)} businesses</strong> you flash at checkout, and <strong style="color: #111827;">the 10 best deals</strong> hand-picked every Monday.`)}
        ${p(`Use <strong style="color: #111827;">one</strong> grocery deal in a typical week and you&apos;ve covered the $15. Everything after that is money back in your pocket.`)}
        ${guaranteeHtml()}
        ${ctaHtml(opts.link, "Get the Book, $15 once")}
        ${sign}`),
    };
  }

  if (touch === 3) {
    return {
      subject: "Last email about the Deals book",
      html: wrap(`
        ${p(greeting)}
        ${p(`This is the last email I&apos;ll send you about the Deals book. I don&apos;t want to be that guy.`)}
        ${p(`If you want it, it&apos;s <strong style="color: #111827;">$15 once, yours for life</strong>, and the One-Deal Promise still applies: save $15 in 60 days or email me for a full refund.`)}
        ${ctaHtml(opts.link, "Get the Book, $15 once")}
        ${p(`Either way, the newsletter is free forever.`)}
        ${sign}`),
    };
  }

  // touch 4: plain-text founder note
  return {
    subject: "quick question",
    html: wrap(`
      ${p(greeting)}
      <p style="color: #4b5563; font-size: 14px; line-height: 1.7;">It&apos;s Chad.</p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.7;">
        I noticed you didn&apos;t grab the Deals book, and that&apos;s totally fine. The newsletter is free forever either way.
      </p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.7;">
        But I&apos;m trying to make the book something people actually want, so can I ask: <strong style="color: #111827;">what held you back?</strong>
      </p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.7;">
        Just hit reply. I read every one.
      </p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.7;">Thanks,<br>Chad</p>`),
  };
}

async function sendNurtureTouch(
  subscriber: { id: string; email: string },
  touch: number
): Promise<boolean> {
  const workspace = await getWorkspace();
  const appUrl = await getWorkspaceUrl();
  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const emailClient = await getEmailClient(allSettings);
  if (!emailClient) return false;

  // Need a sent newsletter to hang the recipient record (open/click tracking
  // + working one-click unsubscribe) off of, same as the welcome email.
  const latest = await prisma.newsletterSend.findFirst({
    where: { status: "sent" },
    orderBy: { sentAt: "desc" },
    select: { id: true },
  });
  if (!latest) return false;

  const recipient = await prisma.newsletterRecipient.create({
    data: {
      newsletterSendId: latest.id,
      subscriberId: subscriber.id,
      email: subscriber.email,
    },
  });
  const unsubUrl = `${appUrl}/unsubscribe?r=${recipient.id}&email=${encodeURIComponent(subscriber.email)}`;
  // One-click (RFC 8058) header target: the API endpoint, which accepts the
  // form-encoded POST mail clients send. The footer link above stays on the
  // human page.
  const unsubHeaderUrl = `${appUrl}/api/unsubscribe?r=${recipient.id}&email=${encodeURIComponent(subscriber.email)}`;

  const content = buildTouch(touch, {
    area: workspace.area,
    newsletterName: workspace.name,
    link: dealsLink(appUrl, touch, subscriber.email),
  });

  const htmlBody =
    content.html +
    footerHtml({
      newsletterName: workspace.name,
      appUrl,
      workspaceId: workspace.id,
      email: subscriber.email,
      unsubUrl,
    });

  await emailClient.sendEmail({
    to: subscriber.email,
    subject: content.subject,
    htmlBody,
    textBody: htmlToText(htmlBody),
    headers: {
      "List-Unsubscribe": `<${unsubHeaderUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  await prisma.dealsNurtureTouch.create({
    data: {
      subscriberId: subscriber.id,
      email: subscriber.email,
      touch,
    },
  });
  return true;
}

export interface NurtureRunResult {
  checked: number;
  sent: number;
  skippedPurchased: number;
}

/** Send the next due nurture touch to eligible new subscribers. Runs inside withWorkspace. */
export async function runDealsNurture(now = new Date()): Promise<NurtureRunResult> {
  const result: NurtureRunResult = { checked: 0, sent: 0, skippedPurchased: 0 };
  const windowStart = new Date(now.getTime() - ENROLL_WINDOW_HOURS * 3600 * 1000);

  const subscribers = await prisma.subscriber.findMany({
    where: {
      active: true,
      dealsNurtureOptOut: false,
      subscribedAt: { gte: windowStart },
    },
    orderBy: { subscribedAt: "asc" },
    take: 200,
    select: { id: true, email: true, subscribedAt: true },
  });

  for (const sub of subscribers) {
    result.checked++;
    // Already bought the book -> never nurture.
    const purchase = await prisma.couponBookPurchase.findFirst({
      where: { email: sub.email, active: true },
      select: { id: true },
    });
    if (purchase) {
      result.skippedPurchased++;
      continue;
    }

    const sentTouches = await prisma.dealsNurtureTouch.findMany({
      where: { subscriberId: sub.id },
      select: { touch: true, sentAt: true },
    });
    const sentByTouch = new Map(sentTouches.map((t) => [t.touch, t.sentAt]));

    for (const s of SCHEDULE) {
      if (sentByTouch.has(s.touch)) continue;
      const dueAt = new Date(sub.subscribedAt.getTime() + s.delayHours * 3600 * 1000);
      if (now < dueAt) break; // touches are ordered; later ones aren't due either
      if (s.touch > 1) {
        const prevSentAt = sentByTouch.get(s.touch - 1);
        if (!prevSentAt) break;
        const gapOkAt = new Date(prevSentAt.getTime() + s.minGapHours * 3600 * 1000);
        if (now < gapOkAt) break;
      }
      try {
        const ok = await sendNurtureTouch(sub, s.touch);
        if (ok) result.sent++;
      } catch (err) {
        console.error(`Deals nurture touch ${s.touch} failed for ${sub.email}:`, err);
      }
      break; // one touch per subscriber per run
    }
  }
  return result;
}
