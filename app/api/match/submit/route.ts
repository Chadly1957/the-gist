import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getDeviceId, MATCH_MAX_SCORE, setDeviceCookie, todayDateKey } from "@/lib/matchGame";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawName = typeof body?.name === "string" ? body.name.trim() : "";
  const score = Number(body?.score);

  if (!Number.isInteger(score) || score < 0 || score > MATCH_MAX_SCORE) {
    return NextResponse.json({ error: "Invalid score." }, { status: 400 });
  }

  const name = (rawName || "Player").slice(0, 16);
  const date = todayDateKey();
  const { deviceId, isNew } = getDeviceId(req);

  try {
    await prisma.matchScore.create({
      data: { date, deviceId, name, score },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "You've already played today." }, { status: 409 });
    }
    console.error("Match score submit error:", err);
    return NextResponse.json({ error: "Could not save your score." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  if (isNew) setDeviceCookie(res, deviceId);
  return res;
}
