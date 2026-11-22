import { Prisma, type PrismaClient } from "@prisma/client";
import {
  generateCrossword,
  type CrosswordGrid,
  type CrosswordSlot,
} from "@/lib/crossword-generate";

// Daily Crossword storage and queue.
//
// CrosswordPuzzle rows are GLOBAL (no workspaceId): both cities play
// the identical puzzle on a given date, keyed by date alone. All access
// goes through the unscoped client (basePrisma) for the same reason
// lib/rewards.ts does: the workspace-scoped client refuses models
// without a workspaceId.
//
// The queue is the fix for the Wordy failure mode (a hand-filled
// calendar ran out and the game silently died). ensureCrosswordQueue()
// tops the queue up to QUEUE_DAYS_AHEAD days ahead and is called from
// the today endpoint and the admin page, so any traffic at all keeps
// the calendar full; there is no cron and no human refill step. If a
// generation ever fails for a date (the generator's relaxed pass makes
// that a shouldn't-happen), the date is skipped and the next call
// retries it.

export const CROSSWORD_QUEUE_DAYS_AHEAD = 30;
export const CROSSWORD_REUSE_WINDOW_DAYS = 45;
/** Missing puzzles generated per ensureCrosswordQueue call (see there). */
export const MAX_GENERATE_PER_CALL = 4;

/** "Today" as YYYY-MM-DD, matching the Wordy convention (server-local). */
export function crosswordTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Add days to a YYYY-MM-DD key, computed in UTC so DST never shifts it. */
export function addDaysKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

export function gridFromRow(row: { grid: unknown }): CrosswordGrid {
  return row.grid as CrosswordGrid;
}

export async function getCrosswordRow(
  db: PrismaClient,
  date: string
): Promise<{ id: string; date: string; grid: CrosswordGrid } | null> {
  const row = await db.crosswordPuzzle.findUnique({ where: { date } });
  if (!row) return null;
  return { id: row.id, date: row.date, grid: gridFromRow(row) };
}

/** Puzzle number = count of puzzles on or before the date (Wordy-style). */
export async function crosswordPuzzleNumber(
  db: PrismaClient,
  date: string
): Promise<number> {
  return db.crosswordPuzzle.count({ where: { date: { lte: date } } });
}

function buildLastUsed(
  rows: { date: string; grid: unknown }[],
  excludeDate?: string
): Record<string, string> {
  const lastUsed: Record<string, string> = {};
  for (const row of rows) {
    if (excludeDate && row.date === excludeDate) continue;
    const grid = gridFromRow(row);
    for (const slot of grid.slots) {
      if (!lastUsed[slot.answer] || lastUsed[slot.answer] < row.date) {
        lastUsed[slot.answer] = row.date;
      }
    }
  }
  return lastUsed;
}

/**
 * Top the queue up so every date from today through today +
 * CROSSWORD_QUEUE_DAYS_AHEAD has a puzzle. Missing dates are generated
 * in ascending order, each new puzzle's words joining the reuse-window
 * map before the next date is generated. Safe under concurrency: a
 * racing insert loses on the date unique index and is skipped.
 */
export async function ensureCrosswordQueue(db: PrismaClient): Promise<void> {
  const today = crosswordTodayKey();
  const end = addDaysKey(today, CROSSWORD_QUEUE_DAYS_AHEAD);
  const rows = await db.crosswordPuzzle.findMany({
    where: {
      date: {
        gte: addDaysKey(today, -CROSSWORD_REUSE_WINDOW_DAYS),
        lte: end,
      },
    },
    select: { date: true, grid: true },
    orderBy: { date: "asc" },
  });
  const have = new Set(rows.map((row) => row.date));
  const lastUsed = buildLastUsed(rows);

  // Generate at most a few missing days per call, earliest first, so
  // no single request does unbounded work: generation is fast on
  // ordinary days but a hard day can take a second or two, and the
  // first-ever top-up has 31 days to build. The queue self-heals a
  // few days at a time on ordinary traffic (the crossword page, its
  // API calls, and this admin view all land here); today's puzzle is
  // always first in line.
  let generatedThisCall = 0;
  for (let offset = 0; offset <= CROSSWORD_QUEUE_DAYS_AHEAD; offset++) {
    const date = addDaysKey(today, offset);
    if (have.has(date)) continue;
    if (generatedThisCall >= MAX_GENERATE_PER_CALL) break;
    const grid = generateCrossword({
      seedKey: date,
      lastUsed,
      windowStart: addDaysKey(date, -CROSSWORD_REUSE_WINDOW_DAYS),
    });
    if (!grid) continue; // retried on the next call; never blocks the queue
    generatedThisCall++;
    try {
      await db.crosswordPuzzle.create({
        data: { date, grid: grid as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
    have.add(date);
    for (const slot of grid.slots) lastUsed[slot.answer] = date;
  }
}

/**
 * Rebuild one day's puzzle (admin Regenerate). The replacement respects
 * the 45-day reuse window against every other puzzle within 45 days on
 * either side. The seed carries a timestamp so a regenerate actually
 * produces a fresh puzzle instead of the deterministic original. If
 * generation somehow fails, the existing puzzle is left untouched.
 */
export async function regenerateCrosswordForDate(
  db: PrismaClient,
  date: string
): Promise<CrosswordGrid | null> {
  const rows = await db.crosswordPuzzle.findMany({
    where: {
      date: {
        gte: addDaysKey(date, -CROSSWORD_REUSE_WINDOW_DAYS),
        lte: addDaysKey(date, CROSSWORD_REUSE_WINDOW_DAYS),
      },
    },
    select: { date: true, grid: true },
  });
  const lastUsed = buildLastUsed(rows, date);
  const grid = generateCrossword({
    seedKey: `${date}:regen:${Date.now()}`,
    lastUsed,
    windowStart: addDaysKey(date, -CROSSWORD_REUSE_WINDOW_DAYS),
  });
  if (!grid) return null;
  await db.crosswordPuzzle.upsert({
    where: { date },
    create: { date, grid: grid as unknown as Prisma.InputJsonValue },
    update: { grid: grid as unknown as Prisma.InputJsonValue },
  });
  return grid;
}

export interface PublicCrosswordSlot {
  number: number;
  direction: "across" | "down";
  row: number;
  col: number;
  length: number;
  /** Cell indexes the slot covers. Layout, not solution: safe to send. */
  cells: number[];
  clue: string;
}

/**
 * The today payload: layout and clues only. Answers are stripped here,
 * at the single boundary between the stored grid and the client, so no
 * route can leak them by accident; check / reveal / complete load the
 * stored grid server-side instead.
 */
export function toPublicPuzzle(grid: CrosswordGrid): {
  size: number;
  blacks: number[];
  slots: PublicCrosswordSlot[];
} {
  return {
    size: grid.size,
    blacks: grid.blacks,
    slots: grid.slots.map((slot) => ({
      number: slot.number,
      direction: slot.direction,
      row: slot.row,
      col: slot.col,
      length: slot.length,
      cells: slot.cells,
      clue: slot.clue,
    })),
  };
}

export function findSlot(
  grid: CrosswordGrid,
  number: number,
  direction: string
): CrosswordSlot | null {
  for (const slot of grid.slots) {
    if (slot.number === number && slot.direction === direction) return slot;
  }
  return null;
}
