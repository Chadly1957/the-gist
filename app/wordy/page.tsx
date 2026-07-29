"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import GamePresentingSponsor from "@/components/GamePresentingSponsor";

type LetterState = "correct" | "present" | "absent";
type GamePhase = "loading" | "no-word" | "playing" | "won" | "lost";

interface GameMeta { wordLength: number; maxGuesses: number; puzzleNum: number; date: string; }

const KEYBOARD_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","DEL"],
];

const TILE_COLORS: Record<string, string> = {
  correct: "bg-green-600 border-green-600 text-white",
  present: "bg-yellow-500 border-yellow-500 text-white",
  absent:  "bg-gray-500  border-gray-500  text-white",
  current: "bg-white border-gray-500 text-gray-900 scale-105",
  empty:   "bg-white border-gray-200 text-gray-900",
};

const KEY_COLORS: Record<string, string> = {
  correct: "bg-green-600 text-white",
  present: "bg-yellow-500 text-white",
  absent:  "bg-gray-500  text-white",
  default: "bg-gray-200  text-gray-900 hover:bg-gray-300",
};

function WordyGame() {
  const searchParams = useSearchParams();
  const recipientId = searchParams.get("r");

  const [phase, setPhase]               = useState<GamePhase>("loading");
  const [meta, setMeta]                 = useState<GameMeta | null>(null);
  const [guesses, setGuesses]           = useState<string[]>([]);
  const [results, setResults]           = useState<LetterState[][]>([]);
  const [current, setCurrent]           = useState("");
  const [letterStates, setLetterStates] = useState<Record<string, LetterState>>({});
  const [answer, setAnswer]             = useState<string | null>(null);
  const [errorMsg, setErrorMsg]         = useState("");
  const [shaking, setShaking]           = useState(false);
  const [copied, setCopied]             = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  function showError(msg: string) {
    setErrorMsg(msg);
    setShaking(true);
    setTimeout(() => { setShaking(false); setErrorMsg(""); }, 700);
  }

  function updateLetterStates(guess: string, result: LetterState[]) {
    setLetterStates((prev) => {
      const next = { ...prev };
      result.forEach((r, i) => {
        const l = guess[i];
        if (!next[l] || r === "correct" || (r === "present" && next[l] === "absent")) next[l] = r;
      });
      return next;
    });
  }

  async function finishGame(newPhase: "won" | "lost", revealedAnswer: string, finalGuesses: string[], finalResults: LetterState[][], m: GameMeta) {
    setPhase(newPhase);
    setAnswer(revealedAnswer);
    fetch("/api/wordy/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: m.date, won: newPhase === "won", guesses: finalGuesses.length, maxGuesses: m.maxGuesses, wordLength: m.wordLength, recipientId }),
    }).catch(() => {});
    const lsKey = `decatur_wordy_${m.date}`;
    localStorage.setItem(lsKey, JSON.stringify({ guesses: finalGuesses, results: finalResults, phase: newPhase, answer: revealedAnswer }));
  }

  // Load today's puzzle + check localStorage
  useEffect(() => {
    fetch("/api/wordy/today").then(r => r.json()).then(d => {
      if (!d.hasWord) { setPhase("no-word"); return; }
      setMeta(d);

      const saved = localStorage.getItem(`decatur_wordy_${d.date}`);
      if (saved) {
        try {
          const s = JSON.parse(saved);
          setGuesses(s.guesses || []);
          setResults(s.results || []);
          setPhase(s.phase || "playing");
          if (s.answer) setAnswer(s.answer);
          const ls: Record<string, LetterState> = {};
          (s.results || []).forEach((row: LetterState[], ri: number) => {
            row.forEach((r, ci) => {
              const l = (s.guesses[ri] || "")[ci];
              if (l && (!ls[l] || r === "correct" || (r === "present" && ls[l] === "absent"))) ls[l] = r;
            });
          });
          setLetterStates(ls);
          return;
        } catch { /* fall through to fresh game */ }
      }
      setPhase("playing");
    }).catch(() => setPhase("no-word"));
  }, []);

  const handleGuess = useCallback(async () => {
    if (!meta || phase !== "playing" || submitting) return;
    if (current.length !== meta.wordLength) { showError(`Word must be ${meta.wordLength} letters`); return; }

    setSubmitting(true);
    const res = await fetch("/api/wordy/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: meta.date, guess: current }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) { showError(data.error || "Error"); return; }

    const newGuesses = [...guesses, current];
    const newResults = [...results, data.result as LetterState[]];
    setGuesses(newGuesses);
    setResults(newResults);
    setCurrent("");
    updateLetterStates(current, data.result);

    if (data.won) {
      finishGame("won", data.answer, newGuesses, newResults, meta);
    } else if (newGuesses.length >= meta.maxGuesses) {
      const revealData = await fetch(`/api/wordy/reveal?date=${meta.date}`).then(r => r.json()).catch(() => ({}));
      const finalAnswer = revealData.answer || "?";
      setPhase("lost");
      setAnswer(finalAnswer);
      fetch("/api/wordy/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: meta.date, won: false, guesses: newGuesses.length, maxGuesses: meta.maxGuesses, wordLength: meta.wordLength, recipientId }),
      }).catch(() => {});
      localStorage.setItem(`decatur_wordy_${meta.date}`, JSON.stringify({ guesses: newGuesses, results: newResults, phase: "lost", answer: finalAnswer }));
    } else {
      localStorage.setItem(`decatur_wordy_${meta.date}`, JSON.stringify({ guesses: newGuesses, results: newResults, phase: "playing", answer: null }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, guesses, meta, phase, recipientId, results, submitting]);

  const handleKey = useCallback((key: string) => {
    if (phase !== "playing") return;
    if (key === "ENTER") { handleGuess(); return; }
    if (key === "DEL" || key === "BACKSPACE") { setCurrent(g => g.slice(0, -1)); return; }
    if (/^[A-Z]$/.test(key) && meta && current.length < meta.wordLength) setCurrent(g => g + key);
  }, [current, handleGuess, meta, phase]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("DEL");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleKey]);

  function shareResults() {
    if (!meta) return;
    const score = phase === "won" ? `${guesses.length}/${meta.maxGuesses}` : `X/${meta.maxGuesses}`;
    const grid = results.map(row => row.map(r => r === "correct" ? "🟩" : r === "present" ? "🟨" : "⬛").join("")).join("\n");
    const text = `Decatur Wordy #${meta.puzzleNum} — ${score}\n\n${grid}\n\nSubscribe to Decatur's favorite email for local news, events, and The Gist Decatur Wordy!\nthegistdecatur.com`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const wordLength = meta?.wordLength || 5;
  const cellPx = Math.min(68, Math.max(44, Math.floor((340 - 4 * (wordLength - 1)) / wordLength)));

  if (phase === "loading") return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent" />
    </div>
  );

  if (phase === "no-word") return (
    <div className="text-center py-16 px-6">
      <p className="text-5xl mb-4">📅</p>
      <h2 className="text-xl font-bold text-gray-900 mb-2">No puzzle today</h2>
      <p className="text-gray-500 text-sm">Check back tomorrow for the next Decatur Wordy!</p>
      <Link href="/" className="mt-6 inline-block text-sm text-green-700 font-semibold hover:underline">← Back to The Gist Decatur</Link>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-5 pb-12">
      {/* Floating error toast */}
      {errorMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl z-50 shadow-lg">
          {errorMsg}
        </div>
      )}

      {/* Puzzle info */}
      <div className="text-center">
        <p className="text-sm font-medium text-gray-600">Puzzle #{meta?.puzzleNum} · {meta?.wordLength} letters · {meta?.maxGuesses} guesses</p>
        <p className="text-xs text-gray-400 mt-0.5">All answers are Decatur area related</p>
      </div>

      {/* Grid */}
      <div className={`flex flex-col gap-1 ${shaking ? "animate-bounce" : ""}`}>
        {Array.from({ length: meta?.maxGuesses || 6 }).map((_, rowIdx) => {
          const isCompleted = rowIdx < guesses.length;
          const isCurrent   = rowIdx === guesses.length && phase === "playing";
          const rowGuess    = isCompleted ? guesses[rowIdx] : (isCurrent ? current : "");
          const rowResult   = isCompleted ? results[rowIdx] : [];

          return (
            <div key={rowIdx} className="flex gap-1">
              {Array.from({ length: wordLength }).map((_, colIdx) => {
                const letter = rowGuess[colIdx] || "";
                const state  = rowResult[colIdx] || (letter && isCurrent ? "current" : "empty");
                return (
                  <div
                    key={colIdx}
                    style={{ width: cellPx, height: cellPx }}
                    className={`border-2 flex items-center justify-center text-xl font-bold uppercase select-none transition-colors duration-100 ${TILE_COLORS[state] || TILE_COLORS.empty}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* End-of-game result */}
      {(phase === "won" || phase === "lost") && (
        <div className={`text-center px-5 py-3 rounded-xl w-full max-w-xs ${phase === "won" ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
          {phase === "won" ? (
            <p className="font-bold text-green-800 text-lg">You got it! 🎉</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-600 mb-1">The answer was</p>
              <p className="text-2xl font-bold text-gray-900 tracking-widest">{answer}</p>
            </>
          )}
        </div>
      )}

      {/* Share + back buttons */}
      {(phase === "won" || phase === "lost") && (
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <button onClick={shareResults}
            className="w-full flex items-center justify-center gap-2 bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-green-800 transition-colors">
            {copied
              ? <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
              : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>Share Results</>
            }
          </button>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back to thegistdecatur.com</Link>
        </div>
      )}

      {/* Keyboard */}
      <div className="flex flex-col gap-1.5 items-center w-full max-w-sm mt-1">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1 justify-center">
            {row.map((key) => {
              const isWide = key === "ENTER" || key === "DEL";
              const color = isWide ? KEY_COLORS.default : (KEY_COLORS[letterStates[key]] || KEY_COLORS.default);
              return (
                <button key={key} onClick={() => handleKey(key)} disabled={phase !== "playing"}
                  className={`h-14 rounded-lg font-bold text-xs transition-colors active:scale-95 disabled:cursor-default ${isWide ? "px-2.5 min-w-[50px]" : "w-9"} ${color}`}>
                  {key === "DEL" ? "⌫" : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WordyPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 py-3">
        <div className="max-w-lg mx-auto px-6 flex items-center justify-between">
          <Link href="/"><Logo className="h-10 w-auto" /></Link>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">Decatur Wordy</p>
            <p className="text-xs text-gray-400">Daily puzzle · all answers Decatur area</p>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        <GamePresentingSponsor game="wordy" />
        <div className="pt-2">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent" /></div>}>
            <WordyGame />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
