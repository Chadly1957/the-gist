import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMatchScoreTable } from "@/lib/matchScores";
import { getDeviceId, MATCH_LEADERBOARD_SIZE, todayDateKey } from "@/lib/matchGame";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = todayDateKey();
  const { deviceId } = getDeviceId(req);

  await ensureMatchScoreTable();

  const rows = await prisma.matchScore.findMany({
    where: { date },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: MATCH_LEADERBOARD_SIZE,
  });

  const entries = rows.map((row) => ({
    name: row.name,
    score: row.score,
    isYou: row.deviceId === deviceId,
  }));

  return NextResponse.json({ date, entries });
}
