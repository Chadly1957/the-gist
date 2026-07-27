import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient, htmlToText } from "@/lib/email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const maxDuration = 300;

// Returns how many active subscribers were missed in a given send.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const [recipientRows, activeSubscribers] = await Promise.all([
    prisma.newsletterRecipient.findMany({
      where: { newsletterSendId: id },
      select: { email: true },
    }),
    prisma.subscriber.findMany({
      where: { active: true },
      select: { email: true },
    }),
  ]);

  const sentEmails = new Set(recipientRows.map((r) => r.email));
  const missedCount = activeSubscribers.filter((s) => !sentEmails.has(s.email)).length;

  return NextResponse.json({ count: missedCount });
}

// Sends the original newsletter only to active subscribers who were not
// included in the original send's recipient list.
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

  const [recipientRows, activeSubscribers] = await Promise.all([
    prisma.newsletterRecipient.findMany({
      where: { newsletterSendId: id },
      select: { email: true },
    }),
    prisma.subscriber.findMany({
      where: { active: true },
      select: { id: true, email: true },
    }),
  ]);

  const sentEmails = new Set(recipientRows.map((r) => r.email));
  const missed = activeSubscribers.filter((s) => !sentEmails.has(s.email));

  if (missed.length === 0) {
    return NextResponse.json({ message: "No missed subscribers — everyone got it!", sent: 0 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  // Look up existing referral codes for missed subscribers
  const missedIds = missed.map((s) => s.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingCodes: any[] = db.referralCode
    ? await db.referralCode.findMany({ where: { subscriberId: { in: missedIds } } })
    : [];
  const refCodeMap = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    existingCodes.map((rc: any) => [rc.subscriberId, rc.code])
  );

  // Create a new send record so tracking and history are cleanly separated
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
    data: missed.map((s) => ({
      newsletterSendId: newSend.id,
      subscriberId: s.id,
      email: s.email,
    })),
  });
  const newRecipients = await prisma.newsletterRecipient.findMany({
    where: { newsletterSendId: newSend.id },
    select: { id: true, email: true },
  });

  // The stored htmlBody already has RIDPLACEHOLDER / EMAILPLACEHOLDER / REFCODEPLACEHOLDER
  // as literal strings — just swap them per recipient.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const personalized = newRecipients.map((r: any) => {
    const sub = missed.find((s) => s.email === r.email);
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
    message: `Sent to ${newRecipients.length} missed subscribers.`,
    sent: newRecipients.length,
  });
}
