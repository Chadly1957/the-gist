import { prisma } from "@/lib/db";
import { getEmailClient, htmlToText } from "@/lib/email";

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
  const emailClient = getEmailClient(allSettings);
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

  const personalizedHtml = latest.htmlBody
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
