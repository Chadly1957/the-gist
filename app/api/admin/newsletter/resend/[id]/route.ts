import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getEmailClient, htmlToText } from "@/lib/email";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function generateRefCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const existingSend = await prisma.newsletterSend.findUnique({ where: { id } });
  if (!existingSend) {
    return NextResponse.json({ error: "Newsletter send not found." }, { status: 404 });
  }

  const allSettings = Object.fromEntries(
    (await prisma.setting.findMany()).map((r) => [r.key, r.value])
  );
  const emailClient = getEmailClient(allSettings);
  if (!emailClient) {
    return NextResponse.json(
      { error: "Email provider not configured. Add credentials in Settings." },
      { status: 503 }
    );
  }

  const activeSubscribers = await prisma.subscriber.findMany({
    where: { active: true },
    select: { id: true, email: true },
  });

  if (activeSubscribers.length === 0) {
    return NextResponse.json({ error: "No active subscribers to send to." }, { status: 400 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  const newSend = await prisma.newsletterSend.create({
    data: {
      subject: existingSend.subject,
      htmlBody: existingSend.htmlBody,
      htmlSnapshot: existingSend.htmlSnapshot,
      recipientCount: 0,
      status: "sent",
    },
  });

  const recipients = await Promise.all(
    activeSubscribers.map((s) =>
      prisma.newsletterRecipient.create({
        data: { newsletterSendId: newSend.id, subscriberId: s.id, email: s.email },
      })
    )
  );

  const hasReferral = existingSend.htmlBody.includes("REFCODEPLACEHOLDER");
  const refCodeMap = new Map<string, string>();
  if (hasReferral) {
    const subscriberIds = activeSubscribers.map((s) => s.id);
    const existingCodes = await db.referralCode.findMany({
      where: { subscriberId: { in: subscriberIds } },
    });
    for (const rc of existingCodes) {
      refCodeMap.set(rc.subscriberId, rc.code);
    }
    for (const sub of activeSubscribers.filter((s) => !refCodeMap.has(s.id))) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const code = generateRefCode();
          await db.referralCode.create({ data: { subscriberId: sub.id, code } });
          refCodeMap.set(sub.id, code);
          break;
        } catch { /* retry on unique constraint */ }
      }
    }
  }

  const personalized = recipients.map((r) => {
    const sub = activeSubscribers.find((s) => s.email === r.email);
    const refCode = (sub && refCodeMap.get(sub.id)) || "nocode";
    const personalizedHtml = existingSend.htmlBody
      .replaceAll("RIDPLACEHOLDER", r.id)
      .replaceAll("EMAILPLACEHOLDER", encodeURIComponent(r.email))
      .replaceAll("REFCODEPLACEHOLDER", refCode);
    const unsubUrl = `${appUrl}/unsubscribe?r=${r.id}&email=${encodeURIComponent(r.email)}`;
    return {
      to: r.email,
      subject: existingSend.subject,
      htmlBody: personalizedHtml,
      textBody: htmlToText(personalizedHtml),
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
    return NextResponse.json({ error: `Send failed: ${result.error}` }, { status: 502 });
  }

  await prisma.newsletterSend.update({
    where: { id: newSend.id },
    data: { recipientCount: recipients.length },
  });

  return NextResponse.json({
    message: `Resent to ${recipients.length.toLocaleString()} subscribers!`,
  });
}
