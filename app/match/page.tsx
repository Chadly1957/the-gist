"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import styles from "./match.module.css";
import { MatchEngine, START_MOVES } from "./matchEngine";

interface TodayStatus {
  date: string;
  alreadyPlayed: boolean;
  score: number | null;
  name: string | null;
}

interface LeaderboardEntry {
  name: string;
  score: number;
  isYou: boolean;
}

type Phase = "loading" | "play" | "played";

function formatDate(key: string) {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MatchPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [dateLabel, setDateLabel] = useState("");
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(START_MOVES);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playedScore, setPlayedScore] = useState<number | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const dateKeyRef = useRef<string>("");

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/match/leaderboard");
      const data = await res.json();
      setLeaderboard(data.entries ?? []);
    } catch {
      // leaderboard is non-critical; leave whatever was already shown
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/match/today");
        const data: TodayStatus = await res.json();
        if (cancelled) return;
        dateKeyRef.current = data.date;
        setDateLabel(formatDate(data.date));
        if (data.alreadyPlayed) {
          setPlayedScore(data.score);
          setPhase("played");
        } else {
          setPhase("play");
        }
        await loadLeaderboard();
      } catch {
        // Fail open so a status-check hiccup doesn't block play entirely --
        // worst case a duplicate submit gets rejected server-side anyway.
        if (!cancelled) setPhase("play");
      }
    })();
    return () => { cancelled = true; };
  }, [loadLeaderboard]);

  useEffect(() => {
    if (phase !== "play" || !boardRef.current || !toastRef.current) return;
    const engine = new MatchEngine(boardRef.current, toastRef.current, styles, dateKeyRef.current, {
      onScore: setScore,
      onMoves: setMoves,
      onGameOver: (final) => {
        setGameOver(true);
        setFinalScore(final);
      },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [phase]);

  async function handleSubmitScore() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/match/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Player", score: finalScore }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Could not save your score.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      setSubmitting(false);
      await loadLeaderboard();
    } catch {
      setSubmitError("Connection error. Please try again.");
      setSubmitting(false);
    }
  }

  const leaderboardPanel = (
    <div className={styles.leaderboard}>
      <div className={styles.leaderboardHead}>
        <p className={styles.leaderboardTitle}>Today&apos;s top scores</p>
        <p className={styles.leaderboardDate}>{dateLabel}</p>
      </div>
      <ul className={styles.lbList}>
        {leaderboard.length === 0 ? (
          <li className={styles.lbEmpty}>No scores yet today — be the first.</li>
        ) : (
          leaderboard.map((entry, i) => (
            <li key={i} className={`${styles.lbRow} ${entry.isYou ? styles.isYou : ""}`}>
              <span className={styles.lbRank}>{i + 1}</span>
              <span className={styles.lbName}>{entry.name}</span>
              <span className={styles.lbScore}>{entry.score.toLocaleString()}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 py-3">
        <div className="max-w-lg mx-auto px-6 flex items-center justify-between">
          <Link href="/"><Logo className="h-10 w-auto" /></Link>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">Gist Match</p>
            <p className="text-xs text-gray-400">
              {dateLabel ? `Daily puzzle · ${dateLabel}` : "Daily puzzle"}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-6 pb-10">
        <div className={styles.wrap}>
          {phase === "loading" && (
            <div className={styles.stage}>
              <p className={styles.hint}>Loading today&apos;s board…</p>
            </div>
          )}

          {phase === "played" && (
            <>
              <div className={styles.stage}>
                <div className={styles.playedCard}>
                  <p className={styles.playedKicker}>You already played today</p>
                  <p className={styles.playedScore}>{(playedScore ?? 0).toLocaleString()} pts</p>
                  <p className={styles.playedNote}>Come back after midnight for a new board.</p>
                </div>
              </div>
              {leaderboardPanel}
            </>
          )}

          {phase === "play" && (
            <>
              <div className={styles.stage}>
                <div className={styles.hud}>
                  <div className={styles.stats}>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Score</span>
                      <span className={styles.statValue}>{score.toLocaleString()}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>Moves</span>
                      <span className={`${styles.statValue} ${moves <= 3 ? styles.isLow : ""}`}>{moves}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.boardWrap}>
                  <div ref={boardRef} className={styles.board} aria-label="Match three board, 6 by 6 items" />
                  <div ref={toastRef} className={styles.toast} aria-hidden="true" />

                  {gameOver && (
                    <div className={styles.overlay}>
                      <div className={styles.overlayCard}>
                        <p className={styles.overlayKicker}>Out of moves</p>
                        <p className={styles.overlayScore}>{finalScore.toLocaleString()} pts</p>
                        {submitted ? (
                          <p className={styles.overlayConfirm}>You&apos;re on today&apos;s board. Come back tomorrow!</p>
                        ) : (
                          <div className={styles.overlaySubmit}>
                            <label className={styles.srOnly} htmlFor="matchNameInput">Your name</label>
                            <input
                              id="matchNameInput"
                              className={styles.nameInput}
                              type="text"
                              maxLength={16}
                              placeholder="Your name"
                              autoComplete="off"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleSubmitScore(); }}
                            />
                            {submitError && <p className={styles.overlayError}>{submitError}</p>}
                            <button
                              className={`${styles.btn} ${styles.btnPrimary}`}
                              type="button"
                              disabled={submitting}
                              onClick={handleSubmitScore}
                            >
                              {submitting ? "Saving…" : "Add to today's board"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <p className={styles.hint}>Drag any item onto another to swap them. It only sticks if it makes a match.</p>
              </div>
              {leaderboardPanel}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
