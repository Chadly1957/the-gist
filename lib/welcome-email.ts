import { prisma } from "@/lib/db";
import { getEmailClient, htmlToText } from "@/lib/email";
import { getWorkspace } from "@/lib/workspace";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function generateRefCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function getOrCreateRefCode(subscriberId: string): Promise<string> {
  try {
    const existing = await db.referralCode.findUnique({ where: { subscriberId } });
    if (existing) return existing.code;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const code = generateRefCode();
        const created = await db.referralCode.create({ data: { subscriberId, code } });
        return created.code;
      } catch { /* unique collision — retry */ }
    }
  } catch { /* referral tables may not exist yet */ }
  return "nocode";
}

// Day-0 upsell: a short Deals P.S. block injected before the footer of the
// welcome email. Pure + exported so the insertion logic is unit-testable.
export function buildDealsPsBlock(opts: {
  area: string;
  appUrl: string;
  linkColor: string;
}): string {
  const dealsLink = `${opts.appUrl}/deals?src=welcome&email=EMAILPLACEHOLDER`;
  return `
<!-- gist-deals-welcome-ps -->
<div style="padding: 0 40px 8px;">
  <div style="border-top: 1px solid #e5e7eb; margin: 4px 0 20px;"></div>
  <p style="font-family: Georgia, serif; font-size: 15px; line-height: 1.65; color: #374151; margin: 0;">
    <strong style="color: #111827;">P.S.</strong> The newsletter is free forever.
    Separately, I built <strong style="color: #111827;">The Gist Deals</strong>:
    a digital book of real discounts from local ${opts.area} businesses,
    right on your phone. $15 once, yours for life.
    <a href="${dealsLink}" style="color: ${opts.linkColor}; font-weight: bold;">See what&apos;s inside</a>
  </p>
</div>`;
}

export function injectDealsPs(htmlBody: string, psBlock: string): string {
  if (htmlBody.includes('<div class="footer">')) {
    return htmlBody.replace('<div class="footer">', `${psBlock}\n    <div class="footer">`);
  }
  return htmlBody.replace("</body>", `${psBlock}\n</body>`);
}

export async function sendWelcomeEmail(
  subscriber: { id: string; email: string },
  appUrl: string
): Promise<void> {
  // Find the most recent successfully-sent newsletter
  const latest = await prisma.newsletterSend.findFirst({
    where: { status: "sent" },
    orderBy: { sentAt: "desc" },
    select: { id: true, subject: true, htmlBody: true },
  });

  // Skip if no sent newsletter exists yet, or if it was stored without personalization placeholders
  if (!latest || !latest.htmlBody.includes("RIDPLACEHOLDER")) return;

  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const emailClient = await getEmailClient(allSettings);
  if (!emailClient) return;

  // Create a recipient record so open/click tracking works for this send
  const recipient = await prisma.newsletterRecipient.create({
    data: {
      newsletterSendId: latest.id,
      subscriberId: subscriber.id,
      email: subscriber.email,
    },
  });

  const refCode = await getOrCreateRefCode(subscriber.id);
  const unsubUrl = `${appUrl}/unsubscribe?r=${recipient.id}&email=${encodeURIComponent(subscriber.email)}`;

  // Day-0 upsell: a short Deals P.S. injected before the footer. The welcome
  // email is not a distinct template (it re-sends the latest newsletter
  // HTML), so this is the only day-0-specific touchpoint we own.
  const workspace = await getWorkspace();
  const dealsPs = buildDealsPsBlock({
    area: workspace.area,
    appUrl,
    linkColor: workspace.secondaryColor || "#166534",
  });
  const htmlWithPs = injectDealsPs(latest.htmlBody, dealsPs);

  const personalizedHtml = htmlWithPs
    .replaceAll("RIDPLACEHOLDER", recipient.id)
    .replaceAll("EMAILPLACEHOLDER", encodeURIComponent(subscriber.email))
    .replaceAll("REFCODEPLACEHOLDER", refCode);

  await emailClient.sendEmail({
    to: subscriber.email,
    subject: latest.subject,
    htmlBody: personalizedHtml,
    textBody: htmlToText(personalizedHtml),
    headers: {
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
