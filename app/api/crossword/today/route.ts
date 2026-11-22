import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import {
  crosswordPuzzleNumber,
  crosswordTodayKey,
  ensureCrosswordQueue,
  getCrosswordRow,
  toPublicPuzzle,
} from "@/lib/crossword";

export const dynamic = "force-dynamic";

// Today's Daily Crossword: layout, numbering and clues only. Answers
// are never in this payload (toPublicPuzzle strips them); the check,
// reveal and complete endpoints validate against the stored grid
// server-side. The queue top-up runs first so the calendar can never
// silently run dry the way Wordy's hand-filled one did.
export async function GET() {
  const today = crosswordTodayKey();
  await ensureCrosswordQueue(basePrisma);

  const row = await getCrosswordRow(basePrisma, today);
  if (!row) return NextResponse.json({ hasPuzzle: false, date: today });

  const puzzleNum = await crosswordPuzzleNumber(basePrisma, today);
  return NextResponse.json({
    hasPuzzle: true,
    date: today,
    puzzleNum,
    ...toPublicPuzzle(row.grid),
  });
}
