import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { findSlot, getCrosswordRow } from "@/lib/crossword";

export const dynamic = "force-dynamic";

// Server-side checking for the Daily Crossword, so answers never have
// to ship to the client. Modes:
//   letter: { cell }                  -> is that one cell right?
//   word:   { number, direction }     -> per-cell results for a slot
//   grid:   {}                        -> per-cell results for the grid
// `letters` is the player's current 25-character grid (anything that
// is not A-Z counts as empty; "#" cells are black squares).

function normalizeLetters(raw: unknown): string[] {
  const text = typeof raw === "string" ? raw.toUpperCase() : "";
  const cells: string[] = [];
  for (let i = 0; i < 25; i++) {
    const ch = text[i] || "";
    cells.push(/^[A-Z]$/.test(ch) ? ch : "");
  }
  return cells;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const date = body?.date;
  const mode = body?.mode;
  if (!date || typeof date !== "string") {
    return NextResponse.json({ error: "Missing date." }, { status: 400 });
  }
  if (mode !== "letter" && mode !== "word" && mode !== "grid") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  const row = await getCrosswordRow(basePrisma, date);
  if (!row) return NextResponse.json({ error: "No puzzle for this date." }, { status: 404 });
  const grid = row.grid;
  const letters = normalizeLetters(body?.letters);
  const cellCorrect = (cell: number) =>
    letters[cell] !== "" && letters[cell] === grid.answers[cell];

  if (mode === "letter") {
    const cell = Number(body?.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell > 24 || grid.blacks.includes(cell)) {
      return NextResponse.json({ error: "Invalid cell." }, { status: 400 });
    }
    return NextResponse.json({ mode, cell, correct: cellCorrect(cell) });
  }

  if (mode === "word") {
    const slot = findSlot(grid, Number(body?.number), String(body?.direction || ""));
    if (!slot) return NextResponse.json({ error: "Invalid word." }, { status: 400 });
    const results = slot.cells.map((cell) => cellCorrect(cell));
    return NextResponse.json({
      mode,
      number: slot.number,
      direction: slot.direction,
      cells: slot.cells,
      results,
      correct: results.every(Boolean),
    });
  }

  const results: boolean[] = [];
  let complete = true;
  for (let cell = 0; cell < 25; cell++) {
    if (grid.blacks.includes(cell)) {
      results.push(false);
      continue;
    }
    const ok = cellCorrect(cell);
    results.push(ok);
    if (!ok) complete = false;
  }
  return NextResponse.json({ mode, results, complete });
}
