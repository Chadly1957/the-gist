import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sprint = await db.referralSprint.findUnique({ where: { id: params.id } });
  if (!sprint) return NextResponse.json({ error: "Sprint not found." }, { status: 404 });

  // Get all signups for this sprint, count per referral code
  const signups = await db.referralSignup.findMany({
    where: { sprintId: params.id },
    select: { referralCodeId: true },
  });

  const countsMap = new Map<string, number>();
  for (const su of signups) {
    countsMap.set(su.referralCodeId, (countsMap.get(su.referralCodeId) ?? 0) + 1);
  }

  // Find all referral codes that met the goal
  const qualifyingCodeIds = Array.from(countsMap.entries())
    .filter(([, count]) => count >= sprint.goal)
    .map(([codeId]) => codeId);

  if (qualifyingCodeIds.length === 0) {
    return NextResponse.json({ error: "No referrers have met the goal yet." }, { status: 400 });
  }

  // Pick a random winner
  const winnerCodeId = qualifyingCodeIds[Math.floor(Math.random() * qualifyingCodeIds.length)];

  // Look up the subscriber's email from the referral code
  const referralCode = await db.referralCode.findUnique({ where: { id: winnerCodeId } });
  if (!referralCode) return NextResponse.json({ error: "Winner referral code not found." }, { status: 500 });

  const subscriber = await prisma.subscriber.findUnique({ where: { id: referralCode.subscriberId } });
  if (!subscriber) return NextResponse.json({ error: "Winner subscriber not found." }, { status: 500 });

  // Record the winner on the sprint
  const updated = await db.referralSprint.update({
    where: { id: params.id },
    data: {
      winnerEmail: subscriber.email,
      drawnAt: new Date(),
      status: "completed",
    },
  });

  return NextResponse.json({
    sprint: updated,
    winner: {
      email: subscriber.email,
      firstName: subscriber.firstName,
      signupCount: countsMap.get(winnerCodeId) ?? 0,
    },
    totalEligible: qualifyingCodeIds.length,
  });
}
