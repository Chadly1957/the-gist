import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMatchScoreTable } from "@/lib/matchScores";
import { getDeviceId, setDeviceCookie, todayDateKey } from "@/lib/matchGame";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = todayDateKey();
  const { deviceId, isNew } = getDeviceId(req);

  await ensureMatchScoreTable();

  const existing = await prisma.matchScore.findUnique({
    where: { date_deviceId: { date, deviceId } },
  });

  const res = NextResponse.json({
    date,
    alreadyPlayed: !!existing,
    score: existing?.score ?? null,
    name: existing?.name ?? null,
  });

  if (isNew) setDeviceCookie(res, deviceId);
  return res;
}
