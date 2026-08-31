import { prisma } from "@/lib/db";
import { DECATUR_WORD_BANK } from "@/lib/decaturWords";

// How far back to look when avoiding repeats, so the same word doesn't
// resurface too soon.
const REPEAT_AVOID_DAYS = 180;

function dateStr(d: Date) {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Fills any unscheduled days in the next `daysAhead` days (starting today)
 * with a Decatur-themed word, picked to avoid repeating a word used in the
 * last REPEAT_AVOID_DAYS days. Never overwrites a day that already has a
 * word scheduled — manual picks always take precedence.
 */
export async function autofillWordySchedule(daysAhead = 30) {
  const today = new Date();
  const todayStr = dateStr(today);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead - 1);
  const endStr = dateStr(endDate);

  const existing = await prisma.wordyWord.findMany({
    where: { date: { gte: todayStr, lte: endStr } },
    select: { date: true },
  });
  const scheduledDates = new Set(existing.map((w) => w.date));

  const lookbackStart = new Date(today);
  lookbackStart.setDate(lookbackStart.getDate() - REPEAT_AVOID_DAYS);
  const recentlyUsed = await prisma.wordyWord.findMany({
    where: { date: { gte: dateStr(lookbackStart) } },
    select: { word: true },
  });
  const usedWords = new Set(recentlyUsed.map((w) => w.word));

  const bank = DECATUR_WORD_BANK
    .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ""))
    .filter((w) => w.length >= 3 && w.length <= 8);

  const freshPool = shuffled(bank.filter((w) => !usedWords.has(w)));
  const fallbackPool = shuffled(bank); // used only if the fresh pool runs dry

  let freshIdx = 0;
  let fallbackIdx = 0;
  const filled: { date: string; word: string }[] = [];
  const chosenThisRun = new Set<string>();

  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const day = dateStr(d);
    if (scheduledDates.has(day)) continue;

    let word: string | undefined;
    while (freshIdx < freshPool.length) {
      const candidate = freshPool[freshIdx++];
      if (!chosenThisRun.has(candidate)) { word = candidate; break; }
    }
    if (!word) {
      while (fallbackIdx < fallbackPool.length) {
        const candidate = fallbackPool[fallbackIdx++];
        if (!chosenThisRun.has(candidate)) { word = candidate; break; }
      }
    }
    if (!word) break; // word bank fully exhausted, nothing left to assign

    await prisma.wordyWord.create({ data: { date: day, word } });
    chosenThisRun.add(word);
    filled.push({ date: day, word });
  }

  return {
    daysAhead,
    alreadyScheduled: scheduledDates.size,
    filled,
  };
}
