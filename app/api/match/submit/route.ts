import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import { awardMatchPoints, resolveReaderSubscriberId } from "@/lib/rewards";
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

  // Reader Rewards: a submitted score is the day's finish, so it pays
  // the day's Match points, once per reader per day, and only when the
  // workspace's rewards_match_points setting is above 0 (default 0 =
  // off). The reader is resolved from the email the portal link carries
  // or the newsletter recipient id; anonymous players simply play. The
  // score above is already saved, so a points hiccup must never fail
  // the submit: it is logged and the award is skipped.
  let pointsAwarded = 0;
  try {
    const workspace = await getWorkspace();
    const subscriberId = await resolveReaderSubscriberId(
      basePrisma,
      workspace.id,
      {
        email: typeof body?.email === "string" ? body.email : null,
        recipientId: typeof body?.recipientId === "string" ? body.recipientId : null,
      }
    );
    if (subscriberId) {
      pointsAwarded = await awardMatchPoints(basePrisma, {
        workspaceId: workspace.id,
        subscriberId,
        date,
      });
    }
  } catch (err) {
    console.error("Match points award error:", err);
  }

  const res = NextResponse.json({ ok: true, pointsAwarded });
  if (isNew) setDeviceCookie(res, deviceId);
  return res;
}
