"use client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import WorkspaceText from "@/components/workspace/WorkspaceText";

import { workspaceFetch, workspaceStorage } from "@/lib/workspace-client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";
import GamePresentingSponsor from "@/components/GamePresentingSponsor";

type Direction = "across" | "down";
type Phase = "loading" | "no-puzzle" | "playing" | "finished";

interface PublicSlot {
  number: number;
  direction: Direction;
  row: number;
  col: number;
  length: number;
  cells: number[];
  clue: string;
}

interface PuzzleMeta {
  date: string;
  puzzleNum: number;
  size: number;
  blacks: number[];
  slots: PublicSlot[];
}

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M", "DEL"],
];

function cellIndex(row: number, col: number) {
  return row * 5 + col;
}

function CrosswordGame() {
  const { workspace, prefix } = useWorkspace();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [meta, setMeta] = useState<PuzzleMeta | null>(null);
  const [letters, setLetters] = useState<string[]>(Array(25).fill(""));
  const [selected, setSelected] = useState(0);
  const [direction, setDirection] = useState<Direction>("across");
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState("");
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const completedRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blackSet = new Set(meta?.blacks || []);
  const slots = meta?.slots || [];

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  function slotFor(cell: number, dir: Direction): PublicSlot | null {
    for (const slot of slots) {
      if (slot.direction === dir && slot.cells.includes(cell)) return slot;
    }
    return null;
  }

  function activeSlot(): PublicSlot | null {
    return slotFor(selected, direction) || slotFor(selected, direction === "across" ? "down" : "across");
  }

  function persist(
    nextLetters: string[],
    nextWrong: Set<number>,
    nextLocked: Set<number>,
    finished: boolean,
    m: PuzzleMeta
  ) {
    workspaceStorage.setItem(
      `decatur_crossword_${m.date}`,
      JSON.stringify({
        letters: nextLetters,
        wrong: Array.from(nextWrong),
        locked: Array.from(nextLocked),
        finished,
      })
    );
  }

  // Load today's puzzle + restore any in-progress game.
  useEffect(() => {
    workspaceFetch("/api/crossword/today")
      .then((r) => r.json())
      .then((d) => {
        if (!d.hasPuzzle) {
          setPhase("no-puzzle");
          return;
        }
        const m: PuzzleMeta = {
          date: d.date,
          puzzleNum: d.puzzleNum,
          size: d.size,
          blacks: d.blacks,
          slots: d.slots,
        };
        setMeta(m);
        const blacks = new Set(m.blacks);
        const firstOpen = Array.from({ length: 25 }, (_, i) => i).find((i) => !blacks.has(i)) ?? 0;
        setSelected(firstOpen);
        const saved = workspaceStorage.getItem(`decatur_crossword_${d.date}`);
        if (saved) {
          try {
            const s = JSON.parse(saved);
            if (Array.isArray(s.letters) && s.letters.length === 25) {
              setLetters(s.letters);
              setWrong(new Set(s.wrong || []));
              setLocked(new Set(s.locked || []));
              if (s.finished) {
                completedRef.current = true;
                setPhase("finished");
                return;
              }
            }
          } catch {
            /* fall through to a fresh game */
          }
        }
        setPhase("playing");
      })
      .catch(() => setPhase("no-puzzle"));
  }, []);

  const finish = useCallback(
    async (finalLetters: string[], m: PuzzleMeta) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setPhase("finished");
      const res = await workspaceFetch("/api/crossword/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: m.date,
          letters: finalLetters.map((l) => l || " ").join(""),
          email: email || undefined,
        }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (res && typeof res.pointsAwarded === "number" && res.pointsAwarded > 0) {
        setPointsAwarded(res.pointsAwarded);
      }
    },
    [email]
  );

  // After any letter change, a completely filled grid is auto-checked;
  // a fully correct one finishes the game.
  const maybeFinish = useCallback(
    async (nextLetters: string[], m: PuzzleMeta) => {
      const blacks = new Set(m.blacks);
      for (let i = 0; i < 25; i++) {
        if (!blacks.has(i) && !nextLetters[i]) return;
      }
      const res = await workspaceFetch("/api/crossword/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: m.date,
          mode: "grid",
          letters: nextLetters.map((l) => l || " ").join(""),
        }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (res && res.complete) {
        persist(nextLetters, new Set(), locked, true, m);
        setWrong(new Set());
        finish(nextLetters, m);
      }
    },
    [finish, locked]
  );

  function applyLetters(next: string[]) {
    if (!meta) return;
    setLetters(next);
    persist(next, wrong, locked, phase === "finished", meta);
    if (phase === "playing") maybeFinish(next, meta);
  }

  function selectCell(cell: number) {
    if (!meta || blackSet.has(cell)) return;
    if (cell === selected) {
      const other = direction === "across" ? "down" : "across";
      if (slotFor(cell, other)) setDirection(other);
      return;
    }
    setSelected(cell);
    if (!slotFor(cell, direction)) {
      setDirection(direction === "across" ? "down" : "across");
    }
  }

  function moveSelection(dRow: number, dCol: number) {
    if (!meta) return;
    const row = Math.floor(selected / 5) + dRow;
    const col = (selected % 5) + dCol;
    if (row < 0 || row > 4 || col < 0 || col > 4) return;
    const target = cellIndex(row, col);
    if (blackSet.has(target)) return;
    setSelected(target);
    if (dRow !== 0) setDirection("down");
    if (dCol !== 0) setDirection("across");
  }

  const handleLetter = useCallback(
    (letter: string) => {
      if (!meta || phase !== "playing" || locked.has(selected)) return;
      const next = letters.slice();
      next[selected] = letter;
      const nextWrong = new Set(wrong);
      nextWrong.delete(selected);
      setWrong(nextWrong);
      applyLetters(next);
      const slot = activeSlot();
      if (slot) {
        const pos = slot.cells.indexOf(selected);
        if (pos >= 0 && pos < slot.cells.length - 1) {
          setSelected(slot.cells[pos + 1]);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [letters, locked, meta, phase, selected, wrong, direction]
  );

  const handleDelete = useCallback(() => {
    if (!meta || phase !== "playing") return;
    const slot = activeSlot();
    if (!slot) return;
    const pos = slot.cells.indexOf(selected);
    if (!locked.has(selected) && letters[selected]) {
      const next = letters.slice();
      next[selected] = "";
      const nextWrong = new Set(wrong);
      nextWrong.delete(selected);
      setWrong(nextWrong);
      applyLetters(next);
      return;
    }
    if (pos > 0) {
      const prev = slot.cells[pos - 1];
      setSelected(prev);
      if (!locked.has(prev) && letters[prev]) {
        const next = letters.slice();
        next[prev] = "";
        const nextWrong = new Set(wrong);
        nextWrong.delete(prev);
        setWrong(nextWrong);
        applyLetters(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, locked, meta, phase, selected, wrong, direction]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      if (/^[a-zA-Z]$/.test(e.key)) handleLetter(e.key.toUpperCase());
      else if (e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveSelection(0, -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(0, 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1, 0);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1, 0);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        selectCell(selected);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleLetter, handleDelete, phase, selected, direction, meta]);

  async function runCheck(mode: "letter" | "word" | "grid") {
    if (!meta || busy || phase !== "playing") return;
    const slot = activeSlot();
    if (mode === "word" && !slot) return;
    setBusy(true);
    const res = await workspaceFetch("/api/crossword/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: meta.date,
        mode,
        letters: letters.map((l) => l || " ").join(""),
        cell: selected,
        number: slot?.number,
        direction: slot?.direction,
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (!res) return;

    const nextWrong = new Set(wrong);
    const nextLocked = new Set(locked);
    if (mode === "letter") {
      if (res.correct) {
        nextLocked.add(selected);
        nextWrong.delete(selected);
        showToast("That letter is right.");
      } else {
        if (letters[selected]) nextWrong.add(selected);
        showToast(letters[selected] ? "That letter isn't right." : "Fill in a letter first.");
      }
    } else {
      const cells: number[] = res.cells || (mode === "grid" ? Array.from({ length: 25 }, (_, i) => i) : []);
      const results: boolean[] = res.results || [];
      let anyWrong = false;
      cells.forEach((cell, i) => {
        if (blackSet.has(cell)) return;
        if (results[i]) {
          nextLocked.add(cell);
          nextWrong.delete(cell);
        } else if (letters[cell]) {
          nextWrong.add(cell);
          anyWrong = true;
        }
      });
      if (res.complete) {
        setWrong(new Set());
        setLocked(nextLocked);
        persist(letters, new Set(), nextLocked, true, meta);
        finish(letters, meta);
        return;
      }
      showToast(anyWrong ? "Something in there isn't right yet." : "Everything filled in so far is right.");
    }
    setWrong(nextWrong);
    setLocked(nextLocked);
    persist(letters, nextWrong, nextLocked, false, meta);
  }

  async function runReveal(mode: "letter" | "word") {
    if (!meta || busy || phase !== "playing") return;
    const slot = activeSlot();
    if (mode === "word" && !slot) return;
    setBusy(true);
    const res = await workspaceFetch("/api/crossword/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: meta.date,
        mode,
        cell: selected,
        number: slot?.number,
        direction: slot?.direction,
      }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    if (!res) return;

    const next = letters.slice();
    const nextLocked = new Set(locked);
    const nextWrong = new Set(wrong);
    if (mode === "letter" && typeof res.letter === "string") {
      next[res.cell] = res.letter;
      nextLocked.add(res.cell);
      nextWrong.delete(res.cell);
    } else if (mode === "word" && Array.isArray(res.cells) && typeof res.letters === "string") {
      res.cells.forEach((cell: number, i: number) => {
        next[cell] = res.letters[i];
        nextLocked.add(cell);
        nextWrong.delete(cell);
      });
    }
    setLetters(next);
    setLocked(nextLocked);
    setWrong(nextWrong);
    persist(next, nextWrong, nextLocked, false, meta);
    maybeFinish(next, meta);
  }

  function shareResults() {
    if (!meta) return;
    const gridEmoji = Array.from({ length: 5 }, (_, row) =>
      Array.from({ length: 5 }, (_, col) => {
        const i = cellIndex(row, col);
        return blackSet.has(i) ? "⬛" : "🟩";
      }).join("")
    ).join("\n");
    const text = `${workspace.name} Daily Crossword #${meta.puzzleNum} — solved!\n\n${gridEmoji}\n\nA fresh 5x5 mini every day, free with your local news.\n${window.location.origin}${prefix}/crossword`;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (phase === "no-puzzle" || !meta) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-5xl mb-4">🧩</p>
        <h2 className="text-xl font-bold text-gray-900 mb-2">No puzzle today</h2>
        <p className="text-gray-500 text-sm">Check back tomorrow for the next Daily Crossword.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-green-700 font-semibold hover:underline">
          <WorkspaceText>{"← Back to The Gist Decatur"}</WorkspaceText>
        </Link>
      </div>
    );
  }

  const slot = activeSlot();
  const acrossSlots = slots.filter((s) => s.direction === "across");
  const downSlots = slots.filter((s) => s.direction === "down");
  const numberAt = new Map<number, number>();
  for (const s of slots) numberAt.set(cellIndex(s.row, s.col), s.number);
  const cellPx = 58;

  function clueList(title: string, list: PublicSlot[], dir: Direction) {
    return (
      <div className="flex-1 min-w-[150px]">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{title}</h3>
        <ul className="space-y-0.5">
          {list.map((s) => {
            const isActive = slot && slot.number === s.number && slot.direction === dir;
            return (
              <li key={`${dir}-${s.number}`}>
                <button
                  onClick={() => {
                    setDirection(dir);
                    setSelected(s.cells.find((c) => !locked.has(c) && !letters[c]) ?? s.cells[0]);
                  }}
                  className={`w-full text-left text-[13px] leading-snug px-2 py-1 rounded-md transition-colors ${
                    isActive ? "bg-green-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="font-bold text-gray-800 mr-1">{s.number}.</span>
                  {s.clue}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 pb-12">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl z-50 shadow-lg">
          {toast}
        </div>
      )}

      <div className="text-center">
        <p className="text-sm font-medium text-gray-600">Puzzle #{meta.puzzleNum} · 5 × 5 mini</p>
        <p className="text-xs text-gray-400 mt-0.5">The same puzzle runs in every Gist city today. A new one lands tomorrow.</p>
      </div>

      {/* Active clue bar */}
      <div className="w-full max-w-sm bg-green-700 text-white rounded-lg px-3 py-2 text-sm min-h-[40px] flex items-center">
        {slot ? (
          <span>
            <strong>{slot.number} {slot.direction === "across" ? "Across" : "Down"}:</strong> {slot.clue}
          </span>
        ) : (
          <span>Tap a square to start.</span>
        )}
      </div>

      {/* Grid */}
      <div className="flex flex-col gap-[2px] select-none">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="flex gap-[2px]">
            {Array.from({ length: 5 }, (_, col) => {
              const i = cellIndex(row, col);
              if (blackSet.has(i)) {
                return <div key={col} style={{ width: cellPx, height: cellPx }} className="bg-gray-900 rounded-[2px]" />;
              }
              const inSlot = slot ? slot.cells.includes(i) : false;
              const isSelected = i === selected;
              const num = numberAt.get(i);
              return (
                <button
                  key={col}
                  onClick={() => selectCell(i)}
                  style={{ width: cellPx, height: cellPx }}
                  className={`relative border flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-yellow-200 border-yellow-500"
                      : inSlot
                        ? "bg-green-50 border-gray-300"
                        : "bg-white border-gray-300"
                  }`}
                >
                  {num !== undefined && (
                    <span className="absolute top-[2px] left-[3px] text-[10px] font-semibold text-gray-500 leading-none">
                      {num}
                    </span>
                  )}
                  <span
                    className={`text-2xl font-bold uppercase ${
                      wrong.has(i) ? "text-red-600" : locked.has(i) ? "text-green-700" : "text-gray-900"
                    }`}
                  >
                    {letters[i]}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Finished state */}
      {phase === "finished" && (
        <div className="text-center px-5 py-4 rounded-xl w-full max-w-sm bg-green-50 border border-green-200">
          <p className="font-bold text-green-800 text-lg">Solved! 🎉</p>
          <p className="text-sm text-green-700 mt-1">
            {pointsAwarded > 0
              ? `You earned ${pointsAwarded} Reader Rewards points for finishing today's crossword.`
              : "Nice work. Come back tomorrow for a fresh puzzle."}
          </p>
          <button
            onClick={shareResults}
            className="mt-3 w-full bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-green-800 transition-colors"
          >
            {copied ? "Copied!" : "Share Results"}
          </button>
        </div>
      )}

      {/* Check / Reveal controls */}
      {phase === "playing" && (
        <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
          <button onClick={() => runCheck("letter")} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50">Check Letter</button>
          <button onClick={() => runCheck("word")} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50">Check Word</button>
          <button onClick={() => runCheck("grid")} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50">Check Puzzle</button>
          <button onClick={() => runReveal("letter")} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-50">Reveal Letter</button>
          <button onClick={() => runReveal("word")} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-50">Reveal Word</button>
        </div>
      )}

      {/* On-screen keyboard */}
      {phase === "playing" && (
        <div className="flex flex-col gap-1.5 items-center w-full max-w-sm">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="flex gap-1 justify-center">
              {row.map((key) => {
                const isDel = key === "DEL";
                return (
                  <button
                    key={key}
                    onClick={() => (isDel ? handleDelete() : handleLetter(key))}
                    className={`h-12 rounded-lg font-bold text-sm bg-gray-200 text-gray-900 hover:bg-gray-300 transition-colors active:scale-95 ${isDel ? "px-3 min-w-[52px] text-xs" : "w-9"}`}
                  >
                    {isDel ? "⌫" : key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Clue lists */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg mt-1">
        {clueList("Across", acrossSlots, "across")}
        {clueList("Down", downSlots, "down")}
      </div>
    </div>
  );
}

export default function CrosswordPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        <div className="text-center mb-2">
          <h1 className="text-lg font-bold text-gray-900">Daily Crossword</h1>
          <p className="text-xs text-gray-400">A fresh 5 × 5 mini every day</p>
        </div>
        <GamePresentingSponsor game="crossword" />
        <div className="pt-2">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent" />
              </div>
            }
          >
            <CrosswordGame />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
