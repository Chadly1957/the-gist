import { getWorkspace } from "@/lib/workspace";
import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import {
  HOLD_MINUTES,
  WEEK_TIERS,
  bookableSponsorWeeks,
  countTaken,
  isValidTier,
  mondayOf,
  withWeekLock,
  type WeekTier,
} from "@/lib/sponsor-weeks";

export const dynamic = "force-dynamic";

// Reserve a tier/week slot for 10 minutes while the buyer fills the form.
export async function POST(req: NextRequest) {
  const { tier, weekStart } = await req.json();

  if (!isValidTier(tier)) {
    return NextResponse.json({ error: "Pick a valid package." }, { status: 400 });
  }

  const workspace = await getWorkspace();
  const workspaceId = workspace.id;

  // The current week is bookable while it is still a full week (no issue
  // sent yet); otherwise booking starts next Monday.
  if (typeof weekStart !== "string" || mondayOf(weekStart) !== weekStart || !(await bookableSponsorWeeks(workspaceId)).includes(weekStart)) {
    return NextResponse.json({ error: "Pick a valid week." }, { status: 400 });
  }

  try {
    const hold = await withWeekLock(workspaceId, weekStart, async (tx) => {
      const week = await tx.sponsorWeek.findUniqueOrThrow({
        where: { workspaceId_weekStart: { workspaceId, weekStart } },
        select: { id: true },
      });
      const taken = await countTaken(tx, workspaceId, week.id, tier as WeekTier);
      if (taken >= WEEK_TIERS[tier as WeekTier].slots) {
        return null;
      }
      return tx.sponsorHold.create({
        data: {
          workspaceId,
          weekId: week.id,
          tier,
          expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
        },
        select: { holdToken: true, expiresAt: true },
      });
    });

    if (!hold) {
      return NextResponse.json({ error: "That slot just sold. Please pick another week." }, { status: 409 });
    }
    return NextResponse.json({ holdToken: hold.holdToken, expiresAt: hold.expiresAt.toISOString() });
  } catch (err) {
    console.error("week-holds error:", err);
    return NextResponse.json({ error: "Could not reserve that slot. Please try again." }, { status: 500 });
  }
}

// Release a hold early (buyer backs out).
export async function DELETE(req: NextRequest) {
  const { holdToken } = await req.json();
  if (!holdToken) return NextResponse.json({ error: "Hold token required." }, { status: 400 });
  const workspace = await getWorkspace();
  await basePrisma.sponsorHold.deleteMany({ where: { workspaceId: workspace.id, holdToken } });
  return NextResponse.json({ released: true });
}
