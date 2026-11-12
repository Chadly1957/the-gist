import { prisma } from "@/lib/db";
import { getEmailClient, htmlToText } from "@/lib/email";
import { getDealsBlockCopy, DEALS_BUYER_COPY, resolveDealsPlaceholders } from "@/lib/template-renderer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function generateRefCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export interface ExistingIssueRecipient {
  id: string;
  email: string;
}

export interface SendExistingIssueResult {
  ok: boolean;
  sent: number;
  sendId?: string;
  error?: string;
}

// Sends a previously-sent issue (its stored subject + htmlBody) to the given
// subscribers. This is the same path as the admin send-missed / resend
// routes: a separate NewsletterSend + NewsletterRecipient rows are created
// so open/click tracking and the archive stay clean, the stored HTML is
// personalized per recipient (RID / EMAIL / REFCODE placeholders, the
// dual-purpose Deals block, List-Unsubscribe headers), and delivery goes
// through the workspace's configured email client (getEmailClient).
// Never throws: failures are returned as { ok: false, error } so a
// background caller can log them without failing its own request.
export async function sendExistingIssueToSubscribers(
  originalSend: { id: string; subject: string; htmlBody: string; htmlSnapshot: string | null },
  subscribers: ExistingIssueRecipient[],
  appUrl: string
): Promise<SendExistingIssueResult> {
  if (subscribers.length === 0) return { ok: true, sent: 0 };

  try {
    const allSettings = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await prisma.setting.findMany()).map((r: any) => [r.key, r.value])
    );
    const emailClient = await getEmailClient(allSettings);
    if (!emailClient) {
      return { ok: false, sent: 0, error: "Email provider not configured." };
    }

    // A new send record keeps tracking and history cleanly separated from
    // the original send (same as send-missed).
    const newSend = await prisma.newsletterSend.create({
      data: {
        subject: originalSend.subject,
        htmlBody: originalSend.htmlBody,
        htmlSnapshot: originalSend.htmlSnapshot,
        recipientCount: 0,
        status: "sent",
      },
    });

    await prisma.newsletterRecipient.createMany({
      data: subscribers.map((s) => ({
        newsletterSendId: newSend.id,
        subscriberId: s.id,
        email: s.email,
      })),
    });
    const recipients = await prisma.newsletterRecipient.findMany({
      where: { newsletterSendId: newSend.id },
      select: { id: true, email: true },
    });

    // Referral codes: reuse existing ones, create them for subscribers who
    // don't have one yet (new subscribers won't). Only when the issue has
    // a referral block; a missing ReferralCode table never blocks the send.
    const hasReferral = originalSend.htmlBody.includes("REFCODEPLACEHOLDER");
    const refCodeMap = new Map<string, string>();
    if (hasReferral) {
      try {
        const subscriberIds = subscribers.map((s) => s.id);
        const existingCodes: any[] = db.referralCode
          ? await db.referralCode.findMany({ where: { subscriberId: { in: subscriberIds } } })
          : [];
        for (const rc of existingCodes) refCodeMap.set(rc.subscriberId, rc.code);
        const missing = subscribers.filter((s) => !refCodeMap.has(s.id));
        for (const sub of missing) {
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const code = generateRefCode();
              await db.referralCode.create({ data: { subscriberId: sub.id, code } });
              refCodeMap.set(sub.id, code);
              break;
            } catch {
              // unique constraint violation — retry with a new code
            }
          }
        }
      } catch {
        // Referral codes are a nice-to-have; fall back to "nocode".
      }
    }

    // Dual-purpose Deals block: resolve {{DEALS_*}} placeholders per
    // recipient. No-op for sends stored before the block became
    // dual-purpose.
    const dealsFallbackCopy = getDealsBlockCopy([]);
    const buyerTokens = new Map<string, string>();
    if (originalSend.htmlBody.includes("{{DEALS_URL}}")) {
      const purchases = await prisma.couponBookPurchase.findMany({
        where: { active: true },
        select: { email: true, magicToken: true },
      });
      for (const p of purchases) buyerTokens.set(p.email.toLowerCase(), p.magicToken);
    }

    const personalized = recipients.map((r) => {
      const sub = subscribers.find((s) => s.email === r.email);
      const refCode = (sub && refCodeMap.get(sub.id)) || "nocode";
      const buyerToken = buyerTokens.get(r.email.toLowerCase());
      const html = resolveDealsPlaceholders(
        originalSend.htmlBody
          .replaceAll("RIDPLACEHOLDER", r.id)
          .replaceAll("EMAILPLACEHOLDER", encodeURIComponent(r.email))
          .replaceAll("REFCODEPLACEHOLDER", refCode),
        buyerToken ? DEALS_BUYER_COPY : dealsFallbackCopy,
        buyerToken ? `${appUrl}/deals?token=${buyerToken}` : `${appUrl}/deals?source=newsletter`
      );
      const unsubUrl = `${appUrl}/api/unsubscribe?r=${r.id}&email=${encodeURIComponent(r.email)}`;
      return {
        to: r.email,
        subject: originalSend.subject,
        htmlBody: html,
        textBody: htmlToText(html),
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    const result = await emailClient.sendBatch(personalized);
    if (!result.success) {
      await prisma.newsletterSend.update({
        where: { id: newSend.id },
        data: { status: "failed" },
      });
      return { ok: false, sent: 0, sendId: newSend.id, error: result.error || "Send failed." };
    }

    await prisma.newsletterSend.update({
      where: { id: newSend.id },
      data: { recipientCount: recipients.length },
    });

    return { ok: true, sent: recipients.length, sendId: newSend.id };
  } catch (err) {
    console.error("[send-existing-issue] failed:", err);
    return { ok: false, sent: 0, error: String(err) };
  }
}
