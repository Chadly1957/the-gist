import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const todayStr = new Date().toLocaleDateString("en-CA");
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoStr = weekAgo.toLocaleDateString("en-CA");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString("en-CA");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    if (!db.wordyPlay) {
      return NextResponse.json({ allTime: null, today: null, thisWeek: null, byDay: [] });
    }

    const [totalPlays, totalWins, totalSponsorViews, recentPlays] = await Promise.all([
      db.wordyPlay.count(),
      db.wordyPlay.count({ where: { won: true } }),
      db.wordyPlay.count({ where: { sponsorViewed: true } }),
      db.wordyPlay.findMany({
        where: { date: { gte: thirtyDaysAgoStr } },
        select: { date: true, won: true, sponsorViewed: true },
        orderBy: { date: "desc" },
      }),
    ]);

    // Aggregate by day
    const dayMap = new Map<string, { plays: number; wins: number; sponsorViews: number }>();
    for (const p of recentPlays) {
      const row = dayMap.get(p.date) ?? { plays: 0, wins: 0, sponsorViews: 0 };
      row.plays++;
      if (p.won) row.wins++;
      if (p.sponsorViewed) row.sponsorViews++;
      dayMap.set(p.date, row);
    }

    const todayPlays = recentPlays.filter((p: { date: string }) => p.date === todayStr);
    const weekPlays = recentPlays.filter((p: { date: string }) => p.date >= weekAgoStr);

    const byDay = Array.from(dayMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      allTime: {
        plays: totalPlays,
        wins: totalWins,
        sponsorViews: totalSponsorViews,
      },
      today: {
        plays: todayPlays.length,
        wins: todayPlays.filter((p: { won: boolean }) => p.won).length,
        sponsorViews: todayPlays.filter((p: { sponsorViewed: boolean }) => p.sponsorViewed).length,
      },
      thisWeek: {
        plays: weekPlays.length,
        wins: weekPlays.filter((p: { won: boolean }) => p.won).length,
        sponsorViews: weekPlays.filter((p: { sponsorViewed: boolean }) => p.sponsorViewed).length,
      },
      byDay,
    });
  } catch {
    return NextResponse.json({ allTime: null, today: null, thisWeek: null, byDay: [] });
  }
}
