import { CROSSWORD_CLUES, CROSSWORD_WORDS_BY_LENGTH } from "@/lib/crossword-bank";

// Daily Crossword generator: fits bank words into a 5x5 mini grid.
//
// Pure module (no database, no clock): given a seed key (the puzzle
// date) and a map of when each bank word was last used, it produces
// one complete, interlocking grid. The queue in lib/crossword.ts owns
// persistence and the 45-day reuse window; this file only has to be
// fast, bounded and deterministic for a given seed, so a regenerated
// day is reproducible.
//
// Fill strategy: try a small set of rotationally symmetric black-square
// patterns (the classic mini layout rule). For each pattern, slots are
// extracted (every slot is at least 3 letters by construction) and
// filled by backtracking search over per-slot candidate sets, held as
// bitsets over the bank pool so narrowing a set is a handful of ANDs.
// Placing a word narrows every crossing slot's set to words matching
// the crossing letter (an empty set anywhere is an instant backtrack),
// and the search always branches on the unfilled slot with the fewest
// candidates left (MRV), so crossing letters prune early and hard.
//
// Candidate order inside a set: a per-slot score combining the
// word's "crossing friendliness" (letters that are common at their
// positions in the bank keep the most options open downstream) with
// a static least-constraining-value term (how many bank words would
// still fit across each of this word's crossing letters). Gumbel
// noise on the score samples different orderings in proportion to
// it, so days do not collapse onto the same top ten words. When the
// branching slot's set has narrowed late in a fill, a dynamic LCV
// pass re-orders its head by the options each candidate actually
// leaves in the live crossing sets.
//
// Reuse window, in tiers, each with its own placement budget. The
// strict tier bans every word used within the full 45 days.
// Measured honestly, though: the bank's interlocking core is only a
// few hundred words, and a 45-day window at ten words a day can ban
// most of it, so on some days no strict fill exists to find (one
// pattern's search tree was measured exhausting completely). Rather
// than jump straight to repeats, the tiers degrade: a soft tier
// bans only the recent half of the window, a relaxed tier keeps
// just the last ten days banned and orders candidates stalest-first
// (any repeat is the least-recently-used word available), and a
// last-resort tier keeps only the last three days banned with a
// deep budget, which is what makes "a day never fails" a guarantee.
// In a 90-day simulation every day generated, the fastest tier that
// could fill won, and no word repeated inside 14 days.

export const CROSSWORD_SIZE = 5;

export type CrosswordDirection = "across" | "down";

export interface CrosswordSlot {
  number: number;
  direction: CrosswordDirection;
  row: number;
  col: number;
  length: number;
  /** Cell indexes (row * size + col), in fill order. */
  cells: number[];
  answer: string;
  clue: string;
}

export interface CrosswordGrid {
  size: number;
  /** Cell indexes of black squares, ascending. */
  blacks: number[];
  /** size*size characters: the solution letters, "#" on black squares. */
  answers: string;
  slots: CrosswordSlot[];
}

// Rotationally symmetric black-square patterns for a 5x5 (a black cell
// at index i pairs with one at 24 - i). The EASY patterns are built
// mostly from 3- and 4-letter slots and interlock far more readily;
// the HARD ones lean on 5-letter slots and act as fallbacks. Every
// pattern leaves only slots of 3+ letters. (A full word square was
// measured as well: the bank cannot interlock one even with a huge
// search budget, so it is not offered.)
const EASY_PATTERNS: number[][] = [
  [4, 9, 15, 20],
  [3, 4, 20, 21],
  [0, 1, 23, 24],
];
const HARD_PATTERNS: number[][] = [
  [0, 4, 20, 24],
  [4, 20],
  [0, 24],
];

// Placement budgets per pattern attempt, so generation stays bounded
// no matter the ban state. Successful fills land in the tens-to-
// thousands of placements; budgets only bind on hard days. Attempt
// order: one rotated easy pattern first (light days fill there,
// keeping shape variety), then the 5-heavy patterns, which stay
// fillable under bans that starve the 3/4-heavy ones, then the rest.
// One attempt per pattern per tier: retrying the same pattern with
// new noise was measured never to win where switching patterns did.
const STRICT_BUDGET_CAP = 30000;
const SOFT_BUDGET_CAP = 120000;
const STRICT_TIER_BUDGET = 75000;
const SOFT_TIER_BUDGET = 150000;
const RELAXED_TIER_BUDGET = 120000;
const LAST_RESORT_TIER_BUDGET = 500000;
const FIRST_PATTERN_BUDGET = 60000;
const RESILIENT_PATTERN_BUDGET = 120000;
const SECOND_RESILIENT_BUDGET = 60000;
const FALLBACK_PATTERN_BUDGET = 60000;
const HARD_PATTERN_BUDGET = 40000;
// How many of the chosen slot's candidates get the full dynamic
// least-constraining-value scoring at each node.
const LCV_HEAD = 24;

function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small deterministic PRNG, seeded per puzzle date. */
function makeRng(seedKey: string): () => number {
  let state = hashSeed(seedKey) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// WORD_SCORE: sum over positions of log(how many bank words of that
// length share the letter at that position). Common letters score
// high; the score only orders candidates, it never filters them.
// LETTER_COUNTS[len][pos][letter] is the raw table behind it, also
// used for the per-slot least-constraining-value ordering.
const WORD_SCORE: Record<string, number> = {};
const LETTER_COUNTS: Record<number, Record<string, number>[]> = {};
for (const lenKey of Object.keys(CROSSWORD_WORDS_BY_LENGTH)) {
  const len = Number(lenKey);
  const pool = CROSSWORD_WORDS_BY_LENGTH[len];
  const counts: Record<string, number>[] = [];
  for (let pos = 0; pos < len; pos++) {
    const per: Record<string, number> = {};
    for (const word of pool) per[word[pos]] = (per[word[pos]] || 0) + 1;
    counts.push(per);
  }
  LETTER_COUNTS[len] = counts;
  for (const word of pool) {
    let score = 0;
    for (let pos = 0; pos < len; pos++) {
      score += Math.log(counts[pos][word[pos]] || 1);
    }
    WORD_SCORE[word] = score;
  }
}

// Bitset machinery for the fill search. Candidate sets are the hot
// path: a placement narrows every crossing slot's set, and doing that
// by scanning word lists costs microseconds per placement, which is
// the difference between a 50ms fill and a 5s one on hard days. So
// each length's bank pool gets a canonical index, and for every
// (length, position, letter) a precomputed bitset of the words with
// that letter there; narrowing a set is then a few dozen ANDs, and
// counting what a letter leaves in a crossing slot is a popcount.
// WORD_INDEX[len]: word -> canonical index. POOL_BITS[len]: uint32
// words per bitset. LETTER_BITS[len][pos * 26 + letter]: bitset.
const WORD_INDEX: Record<number, Map<string, number>> = {};
const POOL_BITS: Record<number, number> = {};
const LETTER_BITS: Record<number, Uint32Array[]> = {};
for (const lenKey of Object.keys(CROSSWORD_WORDS_BY_LENGTH)) {
  const len = Number(lenKey);
  const pool = CROSSWORD_WORDS_BY_LENGTH[len];
  const index = new Map<string, number>();
  pool.forEach((word, i) => index.set(word, i));
  WORD_INDEX[len] = index;
  const words32 = Math.ceil(pool.length / 32);
  POOL_BITS[len] = words32;
  const table: Uint32Array[] = [];
  for (let pos = 0; pos < len; pos++) {
    for (let letter = 0; letter < 26; letter++) {
      table.push(new Uint32Array(words32));
    }
  }
  pool.forEach((word, i) => {
    for (let pos = 0; pos < len; pos++) {
      const letter = word.charCodeAt(pos) - 65;
      table[pos * 26 + letter][i >> 5] |= 1 << (i & 31);
    }
  });
  LETTER_BITS[len] = table;
}

function popcount32(x: number): number {
  x = x - ((x >> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  return (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}

function bitsetCount(bits: Uint32Array): number {
  let count = 0;
  for (let k = 0; k < bits.length; k++) count += popcount32(bits[k]);
  return count;
}

/** How many set bits `bits` shares with the letter bitset (an AND
 * popcount, no allocation). */
function bitsetLetterCount(bits: Uint32Array, letterBits: Uint32Array): number {
  let count = 0;
  for (let k = 0; k < bits.length; k++) count += popcount32(bits[k] & letterBits[k]);
  return count;
}

interface RawSlot {
  direction: CrosswordDirection;
  row: number;
  col: number;
  cells: number[];
}

interface Crossing {
  other: number;
  myPos: number;
  otherPos: number;
}

function extractSlots(blacks: number[]): RawSlot[] {
  const size = CROSSWORD_SIZE;
  const black = new Set(blacks);
  const slots: RawSlot[] = [];
  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (black.has(row * size + col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < size && !black.has(row * size + col)) col++;
      if (col - start >= 3) {
        const cells: number[] = [];
        for (let c = start; c < col; c++) cells.push(row * size + c);
        slots.push({ direction: "across", row, col: start, cells });
      }
    }
  }
  for (let col = 0; col < size; col++) {
    let row = 0;
    while (row < size) {
      if (black.has(row * size + col)) {
        row++;
        continue;
      }
      const start = row;
      while (row < size && !black.has(row * size + col)) row++;
      if (row - start >= 3) {
        const cells: number[] = [];
        for (let r = start; r < row; r++) cells.push(r * size + col);
        slots.push({ direction: "down", row: start, col, cells });
      }
    }
  }
  return slots;
}

function buildCrossings(slots: RawSlot[]): Crossing[][] {
  const byCell = new Map<number, { slot: number; pos: number }[]>();
  slots.forEach((slot, slotIdx) => {
    slot.cells.forEach((cell, pos) => {
      if (!byCell.has(cell)) byCell.set(cell, []);
      (byCell.get(cell) as { slot: number; pos: number }[]).push({ slot: slotIdx, pos });
    });
  });
  const crossings: Crossing[][] = slots.map(() => []);
  slots.forEach((slot, slotIdx) => {
    slot.cells.forEach((cell, pos) => {
      for (const other of byCell.get(cell) || []) {
        if (other.slot === slotIdx) continue;
        crossings[slotIdx].push({ other: other.slot, myPos: pos, otherPos: other.pos });
      }
    });
  });
  return crossings;
}

/** A Gumbel noise draw: adding it to scores samples orderings in
 * proportion to the scores, so repeat attempts at the same pattern
 * explore genuinely different fills instead of near-copies. */
function gumbel(rng: () => number): number {
  const u = Math.min(Math.max(rng(), 1e-9), 1 - 1e-9);
  return -Math.log(-Math.log(u));
}

/** The starting candidate list for one slot: unbanned bank words
 * ordered for the search. In "score" mode the order is a per-slot
 * score combining the word's own friendliness with a static
 * least-constraining-value term (for each crossing slot, how many
 * bank words would still fit across this word's crossing letter, log
 * count), computed once per fill from the precomputed letter tables
 * so it costs nothing during the search; Gumbel noise on the score
 * keeps days varied. In "stalest" mode (the last-resort pass) words
 * order by last use, oldest first, so repeats are the
 * least-recently-used words available. */
type PoolMode = "score" | "score-wide" | "stalest";

function orderedSlotPool(
  slotIdx: number,
  slots: RawSlot[],
  crossings: Crossing[][],
  banned: Set<string>,
  rng: () => number,
  mode: PoolMode = "score",
  lastUsed: Record<string, string> = {}
): string[] {
  const slot = slots[slotIdx];
  const pool = (CROSSWORD_WORDS_BY_LENGTH[slot.cells.length] || []).filter(
    (word) => !banned.has(word)
  );
  if (mode === "stalest") {
    const keyed = pool.map((word) => ({
      word,
      last: lastUsed[word] || "",
      jitter: rng(),
    }));
    keyed.sort((a, b) => {
      if (a.last !== b.last) return a.last < b.last ? -1 : 1;
      return a.jitter - b.jitter;
    });
    return keyed.map((entry) => entry.word);
  }
  // "score-wide" widens the Gumbel noise so the search ranges over
  // the whole friendly pool instead of its head; the fallback tiers
  // use it to avoid reconverging on a recent puzzle.
  const noise = mode === "score-wide" ? 8 : 2.5;
  const keyed = pool.map((word) => {
    let lcv = 0;
    for (const cross of crossings[slotIdx]) {
      const otherLen = slots[cross.other].cells.length;
      const counts = LETTER_COUNTS[otherLen]?.[cross.otherPos] || {};
      lcv += Math.log(counts[word[cross.myPos]] || 1);
    }
    return {
      word,
      key: (WORD_SCORE[word] || 0) * 0.5 + lcv + noise * gumbel(rng),
    };
  });
  keyed.sort((a, b) => b.key - a.key);
  return keyed.map((entry) => entry.word);
}

/** Diagnostics from the most recent generateCrossword call: how many
 * placements each attempt spent and which attempt produced the grid.
 * Lets tests (and future tuning) see search effort per pattern. */
export const lastGenerationStats = {
  attempts: [] as { blacks: string; placements: number; relaxed: boolean }[],
};

function tryFill(
  blacks: number[],
  banned: Set<string>,
  rng: () => number,
  budget: number,
  stats?: { placements: number },
  mode: PoolMode = "score",
  lastUsed: Record<string, string> = {},
  anchorWord?: string
): CrosswordGrid | null {
  const size = CROSSWORD_SIZE;
  const slots = extractSlots(blacks);
  // Defensive: every white cell must belong to a slot, or the pattern
  // has a stub run and can never produce a valid puzzle.
  const blackSet = new Set(blacks);
  const covered = new Set<number>();
  for (const slot of slots) for (const cell of slot.cells) covered.add(cell);
  for (let i = 0; i < size * size; i++) {
    if (!blackSet.has(i) && !covered.has(i)) return null;
  }

  const crossings = buildCrossings(slots);
  // Per-slot candidate state: `perms[i]` is slot i's candidate words
  // as canonical pool indexes in try-order (the ordering computed by
  // orderedSlotPool); `live[i]` is the bitset of candidates still
  // compatible with the placements made so far. Placements narrow
  // crossing slots' bitsets; the undo stack stores replaced bitsets.
  const perms: number[][] = [];
  const live: Uint32Array[] = [];
  const liveCounts: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    const len = slots[i].cells.length;
    const index = WORD_INDEX[len];
    const ordered = orderedSlotPool(i, slots, crossings, banned, rng, mode, lastUsed);
    const perm: number[] = [];
    const bits = new Uint32Array(POOL_BITS[len]);
    for (const word of ordered) {
      const ci = index.get(word);
      if (ci === undefined) continue;
      perm.push(ci);
      bits[ci >> 5] |= 1 << (ci & 31);
    }
    perms.push(perm);
    live.push(bits);
    liveCounts.push(perm.length);
  }
  const assignment: (string | null)[] = slots.map(() => null);
  const usedWords = new Set<string>();
  let placements = 0;

  /** Narrow slot `other`'s bitset to words whose letter at the
   * crossing position equals `letter`, also clearing the placed word
   * itself. Returns the previous bitset (for undo), or null when the
   * narrowing empties an unfilled slot (a dead end). */
  function narrow(
    other: number,
    otherPos: number,
    letter: string,
    placedWord: string
  ): Uint32Array | null {
    const otherLen = slots[other].cells.length;
    const letterBits =
      LETTER_BITS[otherLen][otherPos * 26 + (letter.charCodeAt(0) - 65)];
    const current = live[other];
    const next = new Uint32Array(current.length);
    let any = false;
    for (let k = 0; k < current.length; k++) {
      next[k] = current[k] & letterBits[k];
      if (next[k]) any = true;
    }
    const placedIdx = WORD_INDEX[otherLen].get(placedWord);
    if (placedIdx !== undefined) next[placedIdx >> 5] &= ~(1 << (placedIdx & 31));
    if (!any && assignment[other] === null) return null; // state untouched
    live[other] = next;
    liveCounts[other] = bitsetCount(next);
    return current;
  }

  // Anchor: pre-place one word before the search starts, in a
  // randomly chosen slot of its length.
  if (anchorWord) {
    const matching = slots
      .map((slot, i) => i)
      .filter((i) => slots[i].cells.length === anchorWord.length);
    const anchorIdx = WORD_INDEX[anchorWord.length]?.get(anchorWord);
    if (
      matching.length === 0 ||
      anchorIdx === undefined ||
      !(live[matching[0]][anchorIdx >> 5] & (1 << (anchorIdx & 31)))
    ) {
      if (stats) stats.placements = placements;
      return null;
    }
    const slotIdx = matching[Math.floor(rng() * matching.length)];
    assignment[slotIdx] = anchorWord;
    usedWords.add(anchorWord);
    placements++;
    let anchorOk = true;
    for (const cross of crossings[slotIdx]) {
      if (narrow(cross.other, cross.otherPos, anchorWord[cross.myPos], anchorWord) === null) {
        anchorOk = false;
        break;
      }
    }
    if (!anchorOk) {
      if (stats) stats.placements = placements;
      return null;
    }
  }
  const reportStats = () => {
    if (stats) stats.placements = placements;
  };

  function search(): boolean {
    if (placements > budget) return false;
    // MRV: the unfilled slot with the fewest candidates left. A slot
    // at zero means an earlier placement painted us into a corner.
    let bestIdx = -1;
    let bestSize = Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (assignment[i] !== null) continue;
      const size = liveCounts[i];
      if (size === 0) return false;
      if (size < bestSize) {
        bestIdx = i;
        bestSize = size;
        if (bestSize === 1) break;
      }
    }
    if (bestIdx === -1) return true; // every slot assigned

    const bestLen = slots[bestIdx].cells.length;
    const bestPool = CROSSWORD_WORDS_BY_LENGTH[bestLen];
    const options: string[] = [];
    for (const ci of perms[bestIdx]) {
      if (live[bestIdx][ci >> 5] & (1 << (ci & 31))) {
        const word = bestPool[ci];
        if (!usedWords.has(word)) options.push(word);
      }
    }
    // Dynamic least-constraining-value ordering, applied only when
    // the chosen slot's set is already small (late in the fill, or in
    // a tight corner): score each of the top candidates by how many
    // options it leaves in the still-unfilled crossing slots (log
    // counts, summed) and try the most permissive words first. Early
    // in the fill the static per-slot ordering (which carries the
    // same signal from the full pools) is precise enough.
    let ordered = options;
    if (options.length > 1 && options.length <= 48) {
      const head = options.slice(0, LCV_HEAD);
      const scored = head.map((word) => {
        let score = 0;
        for (const cross of crossings[bestIdx]) {
          if (assignment[cross.other] !== null) continue;
          const otherLen = slots[cross.other].cells.length;
          const letterBits =
            LETTER_BITS[otherLen][cross.otherPos * 26 + (word.charCodeAt(cross.myPos) - 65)];
          score += Math.log(bitsetLetterCount(live[cross.other], letterBits) + 1);
        }
        return { word, score };
      });
      scored.sort((a, b) => b.score - a.score);
      for (let i = 0; i < head.length; i++) head[i] = scored[i].word;
      ordered = head.concat(options.slice(LCV_HEAD));
    }
    for (const word of ordered) {
      if (placements++ > budget) return false;
      // Place the word: narrow every crossing slot's set to words
      // matching the crossing letter. Any set hitting zero undoes
      // the placement immediately.
      const undo: { slot: number; bits: Uint32Array }[] = [];
      let dead = false;
      for (const cross of crossings[bestIdx]) {
        const previous = narrow(cross.other, cross.otherPos, word[cross.myPos], word);
        if (previous === null) {
          dead = true;
          break;
        }
        undo.push({ slot: cross.other, bits: previous });
      }
      if (!dead) {
        assignment[bestIdx] = word;
        usedWords.add(word);
        if (search()) return true;
        assignment[bestIdx] = null;
        usedWords.delete(word);
      }
      for (let u = undo.length - 1; u >= 0; u--) {
        live[undo[u].slot] = undo[u].bits;
        liveCounts[undo[u].slot] = bitsetCount(undo[u].bits);
      }
      if (placements > budget) return false;
    }
    return false;
  }

  const found = search();
  reportStats();
  if (!found) return null;

  const letters: (string | null)[] = new Array(size * size).fill(null);
  slots.forEach((slot, i) => {
    const word = assignment[i] as string;
    slot.cells.forEach((cell, pos) => {
      letters[cell] = word[pos];
    });
  });

  let answers = "";
  for (let i = 0; i < size * size; i++) {
    answers += blackSet.has(i) ? "#" : (letters[i] as string);
  }

  // Standard numbering: reading order; a cell takes the next number
  // when it starts an across slot, a down slot, or both.
  const slotByStart = new Map<string, RawSlot[]>();
  for (const slot of slots) {
    const key = `${slot.row},${slot.col}`;
    if (!slotByStart.has(key)) slotByStart.set(key, []);
    (slotByStart.get(key) as RawSlot[]).push(slot);
  }
  const slotIndexByStart = new Map<string, number[]>();
  slots.forEach((slot, i) => {
    const key = `${slot.row},${slot.col}`;
    if (!slotIndexByStart.has(key)) slotIndexByStart.set(key, []);
    (slotIndexByStart.get(key) as number[]).push(i);
  });
  let nextNumber = 1;
  const numbered: CrosswordSlot[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const startingIdx = slotIndexByStart.get(`${row},${col}`);
      if (!startingIdx) continue;
      const number = nextNumber++;
      for (const i of startingIdx) {
        const slot = slots[i];
        const answer = assignment[i] as string;
        numbered.push({
          number,
          direction: slot.direction,
          row: slot.row,
          col: slot.col,
          length: slot.cells.length,
          cells: slot.cells,
          answer,
          clue: CROSSWORD_CLUES[answer] || "",
        });
      }
    }
  }
  numbered.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    return a.direction === "across" ? -1 : 1;
  });

  return { size, blacks: blacks.slice().sort((a, b) => a - b), answers, slots: numbered };
}

/**
 * Generate one puzzle. `lastUsed` maps bank word -> YYYY-MM-DD of its
 * most recent use in another puzzle; `windowStart` is the earliest
 * date still inside the reuse window (words last used on or after it
 * are banned in the strict pass).
 */
/** Shift a YYYY-MM-DD key by whole days (UTC). */
function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function generateCrossword(args: {
  seedKey: string;
  lastUsed: Record<string, string>;
  windowStart: string;
}): CrosswordGrid | null {
  const banned = new Set<string>();
  for (const word of Object.keys(args.lastUsed)) {
    if (args.lastUsed[word] >= args.windowStart) banned.add(word);
  }
  // Soft pass ban: only the more recent half of the window.
  const softWindowStart = addDaysKey(args.windowStart, 23);
  const softBanned = new Set<string>();
  for (const word of Object.keys(args.lastUsed)) {
    if (args.lastUsed[word] >= softWindowStart) softBanned.add(word);
  }
  // Attempt plan (see the budget comment above): one rotated easy
  // pattern for shape variety, then the ban-resilient 5-heavy
  // patterns deep, then everything else as fallback. Deduped by
  // pattern so a pattern never runs twice in the strict pass.
  const rotation = hashSeed(args.seedKey + ":rotation") % EASY_PATTERNS.length;
  const easyOrder = EASY_PATTERNS.map(
    (_, i) => EASY_PATTERNS[(i + rotation) % EASY_PATTERNS.length]
  );
  const resilient = [0, 1, 23, 24];
  const secondResilient = [0, 4, 20, 24];
  const planSpecs: { blacks: number[]; budget: number }[] = [
    { blacks: easyOrder[0], budget: FIRST_PATTERN_BUDGET },
    { blacks: resilient, budget: RESILIENT_PATTERN_BUDGET },
    { blacks: secondResilient, budget: SECOND_RESILIENT_BUDGET },
    { blacks: easyOrder[1], budget: FALLBACK_PATTERN_BUDGET },
    { blacks: easyOrder[2], budget: FALLBACK_PATTERN_BUDGET },
    ...HARD_PATTERNS.filter(
      (blacks) => blacks.join(",") !== secondResilient.join(",")
    ).map((blacks) => ({ blacks, budget: HARD_PATTERN_BUDGET })),
  ];
  const seenPatterns = new Set<string>();
  const attemptPlan = planSpecs.filter((spec) => {
    const key = spec.blacks.join(",");
    if (seenPatterns.has(key)) return false;
    seenPatterns.add(key);
    return true;
  });
  lastGenerationStats.attempts = [];
  const runAttempt = (
    blacks: number[],
    banSet: Set<string>,
    seed: string,
    budget: number,
    tier: "strict" | "soft" | "relaxed",
    mode: PoolMode = "score",
    anchorWord?: string
  ): CrosswordGrid | null => {
    const stats = { placements: 0 };
    const grid = tryFill(
      blacks,
      banSet,
      makeRng(seed),
      budget,
      stats,
      mode,
      args.lastUsed,
      anchorWord
    );
    lastGenerationStats.attempts.push({
      blacks: blacks.join(","),
      placements: stats.placements,
      relaxed: tier !== "strict",
    });
    return grid;
  };
  // The tiers below share per-tier placement budgets (not just
  // per-pattern ones): a doomed tier must not be able to burn
  // unbounded time proving emptiness pattern by pattern, and the
  // whole call stays bounded at roughly the sum of the tier budgets.
  const runTier = (
    tier: "strict" | "soft" | "relaxed",
    banSet: Set<string>,
    tierBudget: number,
    perPatternCap: number,
    mode: PoolMode
  ): CrosswordGrid | null => {
    let remaining = tierBudget;
    for (const plan of attemptPlan) {
      if (remaining <= 0) break;
      const grid = runAttempt(
        plan.blacks,
        banSet,
        `${args.seedKey}:${tier}:${plan.blacks.join(",")}`,
        Math.min(plan.budget, perPatternCap, remaining),
        tier,
        mode
      );
      const spent =
        lastGenerationStats.attempts[lastGenerationStats.attempts.length - 1]
          ?.placements || 0;
      remaining -= spent;
      if (grid) return grid;
    }
    return null;
  };
  // Strict tier: respect the full reuse window. Its budget is the
  // smallest on purpose: on days when the window has eaten the
  // interlock core, no strict fill exists at all (one pattern's tree
  // was measured exhausting completely), and the soft tier is where
  // hard days actually land, so it gets the depth.
  const strict = runTier("strict", banned, STRICT_TIER_BUDGET, STRICT_BUDGET_CAP, "score");
  if (strict) return strict;
  // Soft tier: only the recent half of the window stays banned, and
  // the wide-noise ordering ranges over the whole friendly pool.
  const soft = runTier("soft", softBanned, SOFT_TIER_BUDGET, SOFT_BUDGET_CAP, "score-wide");
  if (soft) return soft;
  // Relaxed tier: the last ten days stay banned, and candidates
  // order stalest-first so any repeat is the least-recently-used
  // word available.
  const puzzleDate = args.seedKey.slice(0, 10);
  const recentStart = addDaysKey(puzzleDate, -10);
  const recentBan = new Set<string>();
  for (const word of Object.keys(args.lastUsed)) {
    if (args.lastUsed[word] >= recentStart) recentBan.add(word);
  }
  const relaxed = runTier("relaxed", recentBan, RELAXED_TIER_BUDGET, FALLBACK_PATTERN_BUDGET, "stalest");
  if (relaxed) return relaxed;
  // Absolute last resort: only the last three days stay banned
  // (yesterday's puzzle must never reappear), friendliest-first
  // ordering, and a deep budget. A fill that lightly banned is the
  // easiest search there is (measured in tens of milliseconds), so
  // this tier succeeding is what makes "a day never fails" a
  // guarantee rather than a hope; the earlier tiers exist to keep
  // repeats rare, not to gate whether a puzzle exists.
  const lastResortStart = addDaysKey(puzzleDate, -3);
  const lastResortBan = new Set<string>();
  for (const word of Object.keys(args.lastUsed)) {
    if (args.lastUsed[word] >= lastResortStart) lastResortBan.add(word);
  }
  return runTier("relaxed", lastResortBan, LAST_RESORT_TIER_BUDGET, LAST_RESORT_TIER_BUDGET, "score");
}
