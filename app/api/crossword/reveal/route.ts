import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { findSlot, getCrosswordRow } from "@/lib/crossword";

export const dynamic = "force-dynamic";

// Reveal part of today's solution: one letter ({ mode: "letter", cell })
// or one whole word ({ mode: "word", number, direction }). This is the
// only public endpoint that returns answer letters, and only the ones
// the player explicitly asked for.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const date = body?.date;
  const mode = body?.mode;
  if (!date || typeof date !== "string") {
    return NextResponse.json({ error: "Missing date." }, { status: 400 });
  }
  if (mode !== "letter" && mode !== "word") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  const row = await getCrosswordRow(basePrisma, date);
  if (!row) return NextResponse.json({ error: "No puzzle for this date." }, { status: 404 });
  const grid = row.grid;

  if (mode === "letter") {
    const cell = Number(body?.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell > 24 || grid.blacks.includes(cell)) {
      return NextResponse.json({ error: "Invalid cell." }, { status: 400 });
    }
    return NextResponse.json({ mode, cell, letter: grid.answers[cell] });
  }

  const slot = findSlot(grid, Number(body?.number), String(body?.direction || ""));
  if (!slot) return NextResponse.json({ error: "Invalid word." }, { status: 400 });
  return NextResponse.json({
    mode,
    number: slot.number,
    direction: slot.direction,
    cells: slot.cells,
    letters: slot.answer,
  });
}
