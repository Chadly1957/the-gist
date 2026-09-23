import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDeviceId, setDeviceCookie, todayDateKey } from "@/lib/matchGame";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = todayDateKey();
  const { deviceId, isNew } = getDeviceId(req);

  const existing = await prisma.matchScore.findUnique({
    where: { workspaceId_date_deviceId: { workspaceId: (await getWorkspace()).id, date, deviceId } },
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
