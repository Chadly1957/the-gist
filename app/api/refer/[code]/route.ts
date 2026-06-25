import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function today() {
  return new Date().toISOString().split("T")[0];
}

async function getActiveSprint() {
  const t = today();
  return db.referralSprint.findFirst({
    where: { status: "active", startDate: { lte: t }, endDate: { gte: t } },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  // Test emails use "preview" as a placeholder — return demo data so the page renders
  if (params.code === "preview") {
    const previewEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return NextResponse.json({
      valid: true,
      referrerFirstName: "Jane",
      sprint: { goal: 5, endDate: previewEndDate, prizeDescription: "$25 gift card (preview)" },
      signupCount: 2,
    });
  }

  const ref = await db.referralCode.findUnique({
    where: { code: params.code },
    include: { subscriber: { select: { firstName: true, active: true } } },
  });

  if (!ref) return NextResponse.json({ valid: false });

  const sprint = await getActiveSprint();
  const signupCount = sprint
    ? await db.referralSignup.count({ where: { referralCodeId: ref.id, sprintId: sprint.id } })
    : 0;

  return NextResponse.json({
    valid: true,
    referrerFirstName: ref.subscriber?.firstName || null,
    sprint: sprint
      ? { goal: sprint.goal, endDate: sprint.endDate, prizeDescription: sprint.prizeDescription }
      : null,
    signupCount,
  });
}

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const { email, firstName } = await req.json();
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const ref = await db.referralCode.findUnique({ where: { code: params.code } });
  if (!ref) return NextResponse.json({ error: "Invalid referral link." }, { status: 404 });

  const existing = await prisma.subscriber.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing?.active) {
    return NextResponse.json({ alreadySubscribed: true, message: "You're already subscribed — thanks!" });
  }

  let subscriber;
  if (existing) {
    subscriber = await prisma.subscriber.update({
      where: { id: existing.id },
      data: { active: true, firstName: firstName?.trim() || existing.firstName },
    });
  } else {
    subscriber = await prisma.subscriber.create({
      data: {
        email: email.toLowerCase().trim(),
        firstName: firstName?.trim() || null,
        active: true,
      },
    });
  }

  const sprint = await getActiveSprint();

  await db.referralSignup.create({
    data: {
      referralCodeId: ref.id,
      newSubscriberId: subscriber.id,
      sprintId: sprint?.id || null,
    },
  });

  return NextResponse.json({ message: "You're subscribed! Thanks for signing up." });
}
