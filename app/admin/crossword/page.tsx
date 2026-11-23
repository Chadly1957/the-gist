"use client";

import { workspaceFetch } from "@/lib/workspace-client";

import { useEffect, useState, useCallback } from "react";

interface AdminSlot {
  number: number;
  direction: "across" | "down";
  row: number;
  col: number;
  length: number;
  cells: number[];
  answer: string;
  clue: string;
}

interface AdminGrid {
  size: number;
  blacks: number[];
  answers: string;
  slots: AdminSlot[];
}

interface AdminPuzzle {
  date: string;
  puzzleNum: number;
  grid: AdminGrid;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[dow]}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

function MiniGrid({ grid }: { grid: AdminGrid }) {
  const blackSet = new Set(grid.blacks);
  const numberAt = new Map<number, number>();
  for (const s of grid.slots) numberAt.set(s.row * 5 + s.col, s.number);
  return (
    <div className="flex flex-col gap-[2px] shrink-0">
      {Array.from({ length: 5 }, (_, row) => (
        <div key={row} className="flex gap-[2px]">
          {Array.from({ length: 5 }, (_, col) => {
            const i = row * 5 + col;
            if (blackSet.has(i)) return <div key={col} className="w-8 h-8 bg-gray-900 rounded-[2px]" />;
            const num = numberAt.get(i);
            return (
              <div
                key={col}
                className="relative w-8 h-8 border border-gray-300 bg-white flex items-center justify-center"
              >
                {num !== undefined && (
                  <span className="absolute top-[1px] left-[2px] text-[8px] font-semibold text-gray-500 leading-none">
                    {num}
                  </span>
                )}
                <span className="text-sm font-bold text-gray-900">{grid.answers[i]}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function CrosswordAdminPage() {
  const [puzzles, setPuzzles] = useState<AdminPuzzle[]>([]);
  const [today, setToday] = useState("");
  const [through, setThrough] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    workspaceFetch("/api/admin/crossword")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setPuzzles(d.puzzles || []);
        setToday(d.today || "");
        setThrough(d.through || "");
      })
      .catch(() => setError("Could not load the crossword queue."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function regenerate(date: string) {
    setRegenerating(date);
    setError("");
    const res = await workspaceFetch("/api/admin/crossword", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setRegenerating(null);
    if (!res || res.error) {
      setError(res?.error || "Regenerate failed.");
      return;
    }
    setPuzzles((prev) =>
      prev.map((p) => (p.date === date ? { ...p, grid: res.puzzle.grid } : p))
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Daily Crossword</h1>
        <p className="text-sm text-gray-500 mt-1">
          One 5 × 5 mini per day, the same puzzle in every city. The queue generates itself
          from the word bank and always stays {puzzles.length > 0 ? "30" : ""} days ahead, so
          it never needs a refill. Words are not reused within 45 days.
        </p>
        {today && (
          <p className="text-xs text-gray-400 mt-2">
            Queue status: {puzzles.length} puzzles queued, {fmt(today)} through {fmt(through)}.
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent" />
        </div>
      ) : puzzles.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          The queue is empty. It refills itself whenever this page or the crossword page is
          visited; if this persists, generation is failing and needs a look.
        </div>
      ) : (
        <div className="space-y-4">
          {puzzles.map((puzzle) => (
            <div key={puzzle.date} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    {fmt(puzzle.date)}
                    {puzzle.date === today && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Today
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400">Puzzle #{puzzle.puzzleNum}</p>
                </div>
                <button
                  onClick={() => regenerate(puzzle.date)}
                  disabled={regenerating === puzzle.date}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                >
                  {regenerating === puzzle.date ? "Regenerating…" : "Regenerate"}
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <MiniGrid grid={puzzle.grid} />
                <div className="flex flex-col sm:flex-row gap-4 flex-1 text-[13px]">
                  {(["across", "down"] as const).map((dir) => (
                    <div key={dir} className="flex-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1">
                        {dir === "across" ? "Across" : "Down"}
                      </h3>
                      <ul className="space-y-1">
                        {puzzle.grid.slots
                          .filter((s) => s.direction === dir)
                          .map((s) => (
                            <li key={`${dir}-${s.number}`} className="text-gray-600 leading-snug">
                              <span className="font-bold text-gray-800">{s.number}.</span>{" "}
                              <span className="font-semibold text-gray-800 tracking-wide">{s.answer}</span>{" "}
                              <span className="text-gray-500">{s.clue}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
