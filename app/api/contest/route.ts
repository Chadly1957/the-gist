import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function generateRefCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function getOrCreateRefCode(subscriberId: string): Promise<string> {
  const existing = await db.referralCode.findUnique({ where: { subscriberId } });
  if (existing) return existing.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code = generateRefCode();
      const created = await db.referralCode.create({ data: { subscriberId, code } });
      return created.code;
    } catch { /* unique collision — retry */ }
  }
  throw new Error("Failed to generate unique referral code");
}

function getActiveSprint() {
  const today = new Date().toISOString().split("T")[0];
  return db.referralSprint.findFirst({
    where: { status: "active", startDate: { lte: today }, endDate: { gte: today } },
    select: { id: true, name: true, startDate: true, endDate: true, goal: true, prizeDescription: true },
  });
}

export async function GET() {
  const sprint = await getActiveSprint();
  return NextResponse.json({ sprint: sprint ?? null });
}

export async function POST(req: NextRequest) {
  const { email, name } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const normalizedEmail = email.trim().toLowerCase();

  // Find or create subscriber
  let subscriber = await prisma.subscriber.findUnique({ where: { email: normalizedEmail } });
  let isNew = false;

  if (!subscriber) {
    subscriber = await prisma.subscriber.create({
      data: {
        email: normalizedEmail,
        firstName: name?.trim() || null,
        active: true,
      },
    });
    isNew = true;
  } else if (name?.trim() && !subscriber.firstName) {
    subscriber = await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { firstName: name.trim() },
    });
  }

  // Ensure they are active
  if (!subscriber.active) {
    subscriber = await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { active: true },
    });
  }

  const code = await getOrCreateRefCode(subscriber.id);
  const refLink = `${appUrl}/refer/${code}`;
  return NextResponse.json({ code, refLink, isNew });
}
