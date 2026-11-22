import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { getAdminSession } from "@/lib/auth";
import {
  CROSSWORD_QUEUE_DAYS_AHEAD,
  addDaysKey,
  crosswordTodayKey,
  ensureCrosswordQueue,
  regenerateCrosswordForDate,
} from "@/lib/crossword";

export const dynamic = "force-dynamic";

// The crossword queue is global (the same puzzle runs in every city),
// so this uses basePrisma like the public crossword endpoints. GET
// tops the queue up (self-healing, same as the today endpoint) and
// returns the next 30 days with full solutions for the admin view.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureCrosswordQueue(basePrisma);

  const today = crosswordTodayKey();
  const through = addDaysKey(today, CROSSWORD_QUEUE_DAYS_AHEAD);
  const [rows, allDates] = await Promise.all([
    basePrisma.crosswordPuzzle.findMany({
      where: { date: { gte: today, lte: through } },
      orderBy: { date: "asc" },
    }),
    basePrisma.crosswordPuzzle.findMany({
      select: { date: true },
      orderBy: { date: "asc" },
    }),
  ]);
  const numberByDate = new Map(allDates.map((row, i) => [row.date, i + 1]));

  return NextResponse.json({
    today,
    through,
    queueDaysAhead: CROSSWORD_QUEUE_DAYS_AHEAD,
    puzzles: rows.map((row) => ({
      date: row.date,
      puzzleNum: numberByDate.get(row.date) ?? 0,
      grid: row.grid,
    })),
  });
}

// Regenerate one day's puzzle (today through the queued horizon). The
// replacement respects the 45-day reuse window against the other days.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const date = body?.date;
  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });
  }
  const today = crosswordTodayKey();
  const through = addDaysKey(today, CROSSWORD_QUEUE_DAYS_AHEAD);
  if (date < today || date > through) {
    return NextResponse.json(
      { error: "Date is outside the queued window." },
      { status: 400 }
    );
  }

  const grid = await regenerateCrosswordForDate(basePrisma, date);
  if (!grid) {
    return NextResponse.json(
      { error: "Could not generate a replacement puzzle; the existing one was kept." },
      { status: 500 }
    );
  }
  const puzzleNum = await basePrisma.crosswordPuzzle.count({
    where: { date: { lte: date } },
  });
  return NextResponse.json({ puzzle: { date, puzzleNum, grid } });
}
