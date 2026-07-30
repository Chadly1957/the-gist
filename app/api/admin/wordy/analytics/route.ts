import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

function emptySponsorCounts() {
  return { wordyImpressions: 0, wordyClicks: 0, matchImpressions: 0, matchClicks: 0 };
}

function addEvent(counts: ReturnType<typeof emptySponsorCounts>, game: string, eventType: string, n = 1) {
  if (game === "wordy" && eventType === "impression") counts.wordyImpressions += n;
  else if (game === "wordy" && eventType === "click") counts.wordyClicks += n;
  else if (game === "match" && eventType === "impression") counts.matchImpressions += n;
  else if (game === "match" && eventType === "click") counts.matchClicks += n;
}

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

    const [
      totalPlays,
      totalWins,
      recentPlays,
      sponsorGroups,
      recentEvents,
      matchTotalPlays,
      matchTotalScore,
      recentMatchScores,
    ] = await Promise.all([
      prisma.wordyPlay.count(),
      prisma.wordyPlay.count({ where: { won: true } }),
      prisma.wordyPlay.findMany({
        where: { date: { gte: thirtyDaysAgoStr } },
        select: { date: true, won: true },
        orderBy: { date: "desc" },
      }),
      prisma.gameSponsorEvent.groupBy({ by: ["game", "eventType"], _count: true }),
      prisma.gameSponsorEvent.findMany({
        where: { date: { gte: thirtyDaysAgoStr } },
        select: { date: true, game: true, eventType: true },
        orderBy: { date: "desc" },
      }),
      prisma.matchScore.count(),
      prisma.matchScore.aggregate({ _sum: { score: true } }),
      prisma.matchScore.findMany({
        where: { date: { gte: thirtyDaysAgoStr } },
        select: { date: true, score: true },
        orderBy: { date: "desc" },
      }),
    ]);

    // Wordy play stats
    const dayMap = new Map<string, { plays: number; wins: number }>();
    for (const p of recentPlays) {
      const row = dayMap.get(p.date) ?? { plays: 0, wins: 0 };
      row.plays++;
      if (p.won) row.wins++;
      dayMap.set(p.date, row);
    }
    const todayPlays = recentPlays.filter((p) => p.date === todayStr);
    const weekPlays = recentPlays.filter((p) => p.date >= weekAgoStr);
    const wordyByDay = Array.from(dayMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Match play stats (score-based, no win/loss)
    const matchDayMap = new Map<string, { plays: number; totalScore: number }>();
    for (const s of recentMatchScores) {
      const row = matchDayMap.get(s.date) ?? { plays: 0, totalScore: 0 };
      row.plays++;
      row.totalScore += s.score;
      matchDayMap.set(s.date, row);
    }
    const todayMatchScores = recentMatchScores.filter((s) => s.date === todayStr);
    const weekMatchScores = recentMatchScores.filter((s) => s.date >= weekAgoStr);
    const avgOf = (scores: { score: number }[]) =>
      scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0;
    const matchByDay = Array.from(matchDayMap.entries())
      .map(([date, { plays, totalScore }]) => ({ date, plays, avgScore: Math.round(totalScore / plays) }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Sponsor impression/click stats (Wordy + Match presenting sponsor)
    const sponsorAllTime = emptySponsorCounts();
    for (const g of sponsorGroups) {
      addEvent(sponsorAllTime, g.game, g.eventType, g._count as unknown as number);
    }

    const sponsorToday = emptySponsorCounts();
    const sponsorWeek = emptySponsorCounts();
    const sponsorDayMap = new Map<string, ReturnType<typeof emptySponsorCounts>>();
    for (const e of recentEvents) {
      if (e.date === todayStr) addEvent(sponsorToday, e.game, e.eventType);
      if (e.date >= weekAgoStr) addEvent(sponsorWeek, e.game, e.eventType);
      const row = sponsorDayMap.get(e.date) ?? emptySponsorCounts();
      addEvent(row, e.game, e.eventType);
      sponsorDayMap.set(e.date, row);
    }
    const sponsorByDay = Array.from(sponsorDayMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      wordy: {
        allTime: { plays: totalPlays, wins: totalWins },
        today: { plays: todayPlays.length, wins: todayPlays.filter((p) => p.won).length },
        thisWeek: { plays: weekPlays.length, wins: weekPlays.filter((p) => p.won).length },
        byDay: wordyByDay,
      },
      match: {
        allTime: { plays: matchTotalPlays, avgScore: matchTotalPlays > 0 ? Math.round((matchTotalScore._sum.score ?? 0) / matchTotalPlays) : 0 },
        today: { plays: todayMatchScores.length, avgScore: avgOf(todayMatchScores) },
        thisWeek: { plays: weekMatchScores.length, avgScore: avgOf(weekMatchScores) },
        byDay: matchByDay,
      },
      sponsor: {
        allTime: sponsorAllTime,
        today: sponsorToday,
        thisWeek: sponsorWeek,
        byDay: sponsorByDay,
      },
    });
  } catch {
    return NextResponse.json({ wordy: null, match: null, sponsor: null });
  }
}
