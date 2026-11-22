import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getCrosswordRow } from "@/lib/crossword";
import { getWorkspace } from "@/lib/workspace";
import { awardCrosswordPoints } from "@/lib/rewards";

export const dynamic = "force-dynamic";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

// Record a Daily Crossword completion. The client sends its final
// grid; the server verifies every white cell against the stored
// solution before anything is recorded, so a completion (and any
// points) can only come from an actually solved puzzle.
//
// Reader identity follows the Reader Rewards email pattern: the
// newsletter/portal link carries the reader's email, resolved here to
// the active Subscriber in the current workspace. Anonymous players
// simply play without points. Points pay only when the workspace's
// rewards_crossword_points setting is above 0 (default 0 = off), and
// the CrosswordPlay unique index plus the ledger's own unique index
// make a day count once per reader.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const date = body?.date;
  if (!date || typeof date !== "string") {
    return NextResponse.json({ error: "Missing date." }, { status: 400 });
  }

  const row = await getCrosswordRow(basePrisma, date);
  if (!row) return NextResponse.json({ error: "No puzzle for this date." }, { status: 404 });
  const grid = row.grid;

  const submitted = typeof body?.letters === "string" ? body.letters.toUpperCase() : "";
  let solved = true;
  for (let cell = 0; cell < 25; cell++) {
    if (grid.blacks.includes(cell)) continue;
    if (submitted[cell] !== grid.answers[cell]) {
      solved = false;
      break;
    }
  }
  if (!solved) {
    return NextResponse.json(
      { ok: false, error: "The grid is not fully correct yet." },
      { status: 400 }
    );
  }

  const workspace = await getWorkspace();

  let subscriberId: string | null = null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email && email.includes("@")) {
    const subscriber = await basePrisma.subscriber.findFirst({
      where: { workspaceId: workspace.id, email, active: true },
      select: { id: true },
    });
    if (subscriber) subscriberId = subscriber.id;
  }

  let alreadyCompleted = false;
  try {
    await basePrisma.crosswordPlay.create({
      data: { workspaceId: workspace.id, date, subscriberId },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      alreadyCompleted = true;
    } else {
      throw error;
    }
  }

  let pointsAwarded = 0;
  if (subscriberId) {
    pointsAwarded = await awardCrosswordPoints(basePrisma, {
      workspaceId: workspace.id,
      subscriberId,
      date,
    });
  }

  return NextResponse.json({ ok: true, alreadyCompleted, pointsAwarded });
}
