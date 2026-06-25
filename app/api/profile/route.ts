import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getSubscriberByRecipient(recipientId: string) {
  const recipient = await prisma.newsletterRecipient.findUnique({
    where: { id: recipientId },
    select: { subscriberId: true, email: true },
  });
  if (!recipient?.subscriberId) return null;
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: recipient.subscriberId },
    select: { id: true, firstName: true, email: true, active: true },
  });
  return subscriber?.active ? subscriber : null;
}

export async function GET(req: NextRequest) {
  const recipientId = new URL(req.url).searchParams.get("r");

  if (recipientId === "preview") {
    return NextResponse.json({ firstName: "Jane", email: "j***@example.com" });
  }

  if (!recipientId) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const subscriber = await getSubscriberByRecipient(recipientId);
  if (!subscriber) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Mask the email for display: show first char + *** + @domain
  const [local, domain] = subscriber.email.split("@");
  const maskedEmail = `${local[0]}***@${domain}`;

  return NextResponse.json({ firstName: subscriber.firstName || "", email: maskedEmail });
}

export async function PATCH(req: NextRequest) {
  const recipientId = new URL(req.url).searchParams.get("r");

  if (recipientId === "preview") {
    return NextResponse.json({ ok: true });
  }

  if (!recipientId) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const { firstName } = await req.json();
  if (typeof firstName !== "string") {
    return NextResponse.json({ error: "Invalid name." }, { status: 400 });
  }

  const subscriber = await getSubscriberByRecipient(recipientId);
  if (!subscriber) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { firstName: firstName.trim() || null },
  });

  return NextResponse.json({ ok: true });
}
