import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient, htmlToText } from "@/lib/email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const maxDuration = 300;

// Returns the count of non-openers for a send who are still active subscribers.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const [nonOpenerRows, activeEmails] = await Promise.all([
    prisma.newsletterRecipient.findMany({
      where: { newsletterSendId: id, openedAt: null },
      select: { email: true },
    }),
    prisma.subscriber.findMany({ where: { active: true }, select: { email: true } }),
  ]);

  const activeEmailSet = new Set(activeEmails.map((s) => s.email));
  const count = nonOpenerRows.filter((r) => activeEmailSet.has(r.email)).length;

  return NextResponse.json({ count });
}

// Resends the original newsletter to non-openers who are still active subscribers.
// Creates a fresh NewsletterSend record so tracking is clean and separate.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const originalSend = await prisma.newsletterSend.findUnique({ where: { id } });
  if (!originalSend) {
    return NextResponse.json({ error: "Send not found." }, { status: 404 });
  }

  const allSettings = Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await prisma.setting.findMany()).map((r: any) => [r.key, r.value])
  );
  const emailClient = getEmailClient(allSettings);
  if (!emailClient) {
    return NextResponse.json({ error: "Email provider not configured." }, { status: 503 });
  }

  // Get recipients who never opened, cross-referenced with currently active subscribers
  const [nonOpenerRows, activeSubscribers] = await Promise.all([
    prisma.newsletterRecipient.findMany({
      where: { newsletterSendId: id, openedAt: null },
      select: { email: true },
    }),
    prisma.subscriber.findMany({
      where: { active: true },
      select: { id: true, email: true },
    }),
  ]);

  const activeMap = new Map(activeSubscribers.map((s) => [s.email, s]));
  const targets = nonOpenerRows
    .map((r) => activeMap.get(r.email))
    .filter((s): s is { id: string; email: string } => s !== undefined);

  if (targets.length === 0) {
    return NextResponse.json({ message: "No non-openers to send to.", sent: 0 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  // Look up existing referral codes
  const targetIds = targets.map((s) => s.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingCodes: any[] = db.referralCode
    ? await db.referralCode.findMany({ where: { subscriberId: { in: targetIds } } })
    : [];
  const refCodeMap = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingCodes.map((rc: any) => [rc.subscriberId, rc.code])
  );

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
    data: targets.map((s) => ({
      newsletterSendId: newSend.id,
      subscriberId: s.id,
      email: s.email,
    })),
  });
  const newRecipients = await prisma.newsletterRecipient.findMany({
    where: { newsletterSendId: newSend.id },
    select: { id: true, email: true },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const personalized = newRecipients.map((r: any) => {
    const sub = targets.find((s) => s.email === r.email);
    const refCode = (sub && refCodeMap.get(sub.id)) || "nocode";
    const html = originalSend.htmlBody
      .replaceAll("RIDPLACEHOLDER", r.id)
      .replaceAll("EMAILPLACEHOLDER", encodeURIComponent(r.email))
      .replaceAll("REFCODEPLACEHOLDER", refCode);
    const unsubUrl = `${appUrl}/unsubscribe?r=${r.id}&email=${encodeURIComponent(r.email)}`;
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

  await emailClient.sendBatch(personalized);

  await prisma.newsletterSend.update({
    where: { id: newSend.id },
    data: { recipientCount: newRecipients.length },
  });

  return NextResponse.json({
    message: `Resent to ${newRecipients.length} non-openers.`,
    sent: newRecipients.length,
  });
}
