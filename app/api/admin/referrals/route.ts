import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sprints = await db.referralSprint.findMany({ orderBy: { createdAt: "desc" } });

  // Fetch all signups (all time) with full detail
  const allSignups: { sprintId: string | null; referralCodeId: string; newSubscriberId: string | null; createdAt: string }[] =
    await db.referralSignup.findMany({
      select: { sprintId: true, referralCodeId: true, newSubscriberId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

  // Fetch all referral codes to map code → subscriber
  const involvedCodeIds = Array.from(new Set(allSignups.map((s) => s.referralCodeId)));
  const codes: { id: string; subscriberId: string }[] = involvedCodeIds.length
    ? await db.referralCode.findMany({
        where: { id: { in: involvedCodeIds } },
        select: { id: true, subscriberId: true },
      })
    : [];
  const codeToSubId = new Map(codes.map((c) => [c.id, c.subscriberId]));

  // Fetch all subscriber info (referrers + referred people)
  const referrerSubIds = codes.map((c) => c.subscriberId);
  const referredSubIds = allSignups.map((s) => s.newSubscriberId).filter(Boolean) as string[];
  const allSubIds = Array.from(new Set([...referrerSubIds, ...referredSubIds]));
  const subscribers = allSubIds.length
    ? await prisma.subscriber.findMany({
        where: { id: { in: allSubIds } },
        select: { id: true, email: true, firstName: true },
      })
    : [];
  const subMap = new Map(subscribers.map((s) => [s.id, s]));

  // Build sprint leaderboards
  const sprintIds = sprints.map((s: { id: string }) => s.id);
  const sprintsWithStats = sprints.map((sprint: { id: string; goal: number }) => {
    const sprintSignups = allSignups.filter((s) => s.sprintId === sprint.id);

    // Group by referrer
    const byReferrer = new Map<string, { signupCount: number; referrals: { email: string; firstName: string | null; joinedAt: string }[] }>();
    for (const su of sprintSignups) {
      const refSubId = codeToSubId.get(su.referralCodeId);
      if (!refSubId) continue;
      if (!byReferrer.has(refSubId)) byReferrer.set(refSubId, { signupCount: 0, referrals: [] });
      const entry = byReferrer.get(refSubId)!;
      entry.signupCount++;
      if (su.newSubscriberId) {
        const referredSub = subMap.get(su.newSubscriberId);
        if (referredSub) entry.referrals.push({ email: referredSub.email, firstName: referredSub.firstName, joinedAt: su.createdAt });
      }
    }

    const leaderboard = Array.from(byReferrer.entries())
      .map(([subId, data]) => {
        const sub = subMap.get(subId);
        return { subscriberId: subId, email: sub?.email ?? "", firstName: sub?.firstName ?? null, ...data };
      })
      .sort((a, b) => b.signupCount - a.signupCount);

    const totalSignups = leaderboard.reduce((a, b) => a + b.signupCount, 0);
    const qualifiedReferrers = leaderboard.filter((e) => e.signupCount >= sprint.goal).length;

    return { ...sprint, totalSignups, qualifiedReferrers, leaderboard };
  });

  // All-time leaderboard (across all signups, any sprint or none)
  const allTimeByReferrer = new Map<string, { signupCount: number; referrals: { email: string; firstName: string | null; joinedAt: string }[] }>();
  for (const su of allSignups) {
    const refSubId = codeToSubId.get(su.referralCodeId);
    if (!refSubId) continue;
    if (!allTimeByReferrer.has(refSubId)) allTimeByReferrer.set(refSubId, { signupCount: 0, referrals: [] });
    const entry = allTimeByReferrer.get(refSubId)!;
    entry.signupCount++;
    if (su.newSubscriberId) {
      const referredSub = subMap.get(su.newSubscriberId);
      if (referredSub) entry.referrals.push({ email: referredSub.email, firstName: referredSub.firstName, joinedAt: su.createdAt });
    }
  }
  const allTimeLeaderboard = Array.from(allTimeByReferrer.entries())
    .map(([subId, data]) => {
      const sub = subMap.get(subId);
      return { subscriberId: subId, email: sub?.email ?? "", firstName: sub?.firstName ?? null, ...data };
    })
    .sort((a, b) => b.signupCount - a.signupCount);

  return NextResponse.json({
    sprints: sprintsWithStats,
    allTimeLeaderboard,
    sprintIds, // included so client doesn't need to derive it
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, startDate, endDate, goal, prizeDescription } = await req.json();

  if (!name || !startDate || !endDate || !goal) {
    return NextResponse.json({ error: "Name, start date, end date, and goal are required." }, { status: 400 });
  }
  if (startDate >= endDate) {
    return NextResponse.json({ error: "End date must be after start date." }, { status: 400 });
  }

  const sprint = await db.referralSprint.create({
    data: {
      name,
      startDate,
      endDate,
      goal: parseInt(String(goal)),
      prizeDescription: prizeDescription || null,
      status: "active",
    },
  });

  return NextResponse.json({ sprint });
}
