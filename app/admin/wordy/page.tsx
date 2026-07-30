"use client";

import { useEffect, useState, useCallback } from "react";

interface WordEntry { id: string; date: string; word: string; puzzleNum: number; }
interface PlayStats { plays: number; wins: number; }
interface WordyDayStats { date: string; plays: number; wins: number; }
interface WordyAnalytics { allTime: PlayStats | null; today: PlayStats | null; thisWeek: PlayStats | null; byDay: WordyDayStats[]; }
interface MatchPlayStats { plays: number; avgScore: number; }
interface MatchDayStats { date: string; plays: number; avgScore: number; }
interface MatchAnalytics { allTime: MatchPlayStats | null; today: MatchPlayStats | null; thisWeek: MatchPlayStats | null; byDay: MatchDayStats[]; }
interface SponsorCounts { wordyImpressions: number; wordyClicks: number; matchImpressions: number; matchClicks: number; }
interface SponsorDayStats extends SponsorCounts { date: string; }
interface SponsorAnalytics { allTime: SponsorCounts; today: SponsorCounts; thisWeek: SponsorCounts; byDay: SponsorDayStats[]; }
interface Analytics { wordy: WordyAnalytics | null; match: MatchAnalytics | null; sponsor: SponsorAnalytics | null; }

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${MONTHS[m-1]} ${d}, ${y}`;
}

function today() { return new Date().toLocaleDateString("en-CA"); }

export default function WordyAdminPage() {
  const [tab, setTab] = useState<"schedule" | "analytics">("schedule");

  // --- Schedule tab ---
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [words, setWords]       = useState<WordEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [wordInput, setWordInput] = useState("");
  const [wordSaving, setWordSaving] = useState(false);
  const [wordError, setWordError]   = useState("");

  // --- Analytics tab ---
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const monthKey = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;

  const loadWords = useCallback(() => {
    fetch(`/api/admin/wordy/words?month=${monthKey}`)
      .then(r => r.json())
      .then(d => setWords(d.words || []));
  }, [monthKey]);

  useEffect(() => { loadWords(); }, [loadWords]);
  useEffect(() => {
    if (tab === "analytics" && !analytics) {
      setAnalyticsLoading(true);
      fetch("/api/admin/wordy/analytics")
        .then(r => r.json())
        .then(d => setAnalytics(d))
        .finally(() => setAnalyticsLoading(false));
    }
  }, [tab, analytics]);

  // Calendar helpers
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const wordMap = new Map(words.map(w => [w.date, w]));

  function calPrev() { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }
  function calNext() { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }

  function selectDay(d: number) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    setSelectedDate(dateStr);
    setWordInput(wordMap.get(dateStr)?.word || "");
    setWordError("");
  }

  async function saveWord() {
    if (!selectedDate) return;
    if (!wordInput.trim()) { await deleteWord(); return; }
    setWordSaving(true);
    setWordError("");
    const res = await fetch("/api/admin/wordy/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, word: wordInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { setWordError(data.error || "Save failed."); }
    else { loadWords(); setSelectedDate(null); }
    setWordSaving(false);
  }

  async function deleteWord() {
    if (!selectedDate) return;
    setWordSaving(true);
    await fetch(`/api/admin/wordy/words/${selectedDate}`, { method: "DELETE" });
    loadWords();
    setSelectedDate(null);
    setWordSaving(false);
  }

  const todayStr = today();

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Games</h1>
        <p className="text-sm text-gray-500 mt-1">Schedule Decatur Wordy's daily word and review game analytics.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {(["schedule","analytics"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "schedule" ? "Word Schedule" : "Analytics"}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ── */}
      {tab === "schedule" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <button onClick={calPrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <p className="text-sm font-semibold text-gray-900">{MONTHS[calMonth]} {calYear}</p>
              <button onClick={calNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const word = wordMap.get(dateStr);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;

                return (
                  <button key={d} onClick={() => selectDay(d)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors relative
                      ${isSelected ? "bg-green-600 text-white" : isToday ? "bg-green-50 border border-green-200" : "hover:bg-gray-50"}
                    `}>
                    <span className={`font-semibold ${isSelected ? "text-white" : "text-gray-900"}`}>{d}</span>
                    <div className="flex gap-0.5 mt-0.5">
                      {word && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-green-200" : "bg-green-500"}`} title={word.word} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-4 mt-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Word set</span>
            </div>
          </div>

          {/* Word form */}
          <div>
            {selectedDate ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{fmt(selectedDate)}</h3>
                  <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <label className="block text-xs font-semibold text-gray-600 mb-1">Word (3–8 letters)</label>
                <input
                  type="text"
                  value={wordInput}
                  onChange={e => setWordInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8))}
                  placeholder="DECATUR"
                  maxLength={8}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 mb-1"
                />
                <p className="text-xs text-gray-400 mb-4">{wordInput.length} / 8 letters · {wordInput.length > 0 ? `${wordInput.length + 1} guesses allowed` : "enter a word"}</p>

                {wordError && <p className="text-xs text-red-500 mb-3">{wordError}</p>}

                <div className="flex gap-2">
                  <button onClick={saveWord} disabled={wordSaving}
                    className="flex-1 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                    {wordSaving ? "Saving…" : "Save Word"}
                  </button>
                  {wordMap.has(selectedDate) && (
                    <button onClick={deleteWord} disabled={wordSaving}
                      className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                <p className="text-gray-400 text-sm">Select a day on the calendar to schedule a word.</p>
              </div>
            )}

            {/* Upcoming scheduled words */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scheduled this month</p>
              {words.length === 0 ? (
                <p className="text-xs text-gray-400">No words scheduled for {MONTHS[calMonth]}.</p>
              ) : (
                <div className="space-y-1">
                  {words.map(w => (
                    <div key={w.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-xs text-gray-400">{fmt(w.date)}</span>
                        <span className="ml-2 font-mono text-sm font-bold text-gray-900 tracking-wide">{w.word}</span>
                      </div>
                      <span className="text-xs text-gray-400">#{w.puzzleNum} · {w.word.length + 1} guesses</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === "analytics" && (
        <div>
          {analyticsLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !analytics?.wordy?.allTime ? (
            <p className="text-sm text-gray-400 py-8 text-center">No play data yet — analytics will appear once people start playing.</p>
          ) : (
            <div className="space-y-8">
              {/* Wordy play stats */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Decatur Wordy — Plays</p>
                <div className="space-y-3">
                  {[
                    { label: "Today", stats: analytics.wordy.today },
                    { label: "Last 7 Days", stats: analytics.wordy.thisWeek },
                    { label: "All Time", stats: analytics.wordy.allTime },
                  ].map(({ label, stats }) => stats && (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
                      <div className="grid grid-cols-2 gap-3 flex-1">
                        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-gray-900">{stats.plays.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Games Played</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                          <p className="text-xl font-bold text-green-700">
                            {stats.plays > 0 ? Math.round((stats.wins / stats.plays) * 100) : 0}%
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">Win Rate · {stats.wins} wins</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gist Match play stats */}
              {analytics.match?.allTime && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gist Match — Plays</p>
                  <div className="space-y-3">
                    {[
                      { label: "Today", stats: analytics.match.today },
                      { label: "Last 7 Days", stats: analytics.match.thisWeek },
                      { label: "All Time", stats: analytics.match.allTime },
                    ].map(({ label, stats }) => stats && (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
                        <div className="grid grid-cols-2 gap-3 flex-1">
                          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                            <p className="text-xl font-bold text-gray-900">{stats.plays.toLocaleString()}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Games Played</p>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                            <p className="text-xl font-bold text-green-700">{stats.avgScore.toLocaleString()}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Avg Score</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Presenting sponsor impressions/clicks */}
              {analytics.sponsor && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Presenting Sponsor — Impressions &amp; Clicks</p>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Period</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Wordy Impressions</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Wordy Clicks</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Match Impressions</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Match Clicks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Today", c: analytics.sponsor.today },
                          { label: "Last 7 Days", c: analytics.sponsor.thisWeek },
                          { label: "All Time", c: analytics.sponsor.allTime },
                        ].map(({ label, c }, i) => (
                          <tr key={label} className={i % 2 === 0 ? "" : "bg-gray-50/50"}>
                            <td className="px-4 py-2.5 text-xs text-gray-700 font-medium">{label}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-900 text-center font-semibold">{c.wordyImpressions}</td>
                            <td className="px-4 py-2.5 text-xs text-blue-600 text-center font-medium">{c.wordyClicks}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-900 text-center font-semibold">{c.matchImpressions}</td>
                            <td className="px-4 py-2.5 text-xs text-blue-600 text-center font-medium">{c.matchClicks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Same presenting sponsor as the newsletter, shown at the top of each game every day they&apos;re booked.</p>
                </div>
              )}

              {/* Per-day breakdown */}
              {analytics.wordy.byDay.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Last 30 Days</p>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Date</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Wordy Plays</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Win %</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Match Plays</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Sponsor Impr.</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Sponsor Clicks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.wordy.byDay.map((row, i) => {
                          const sponsorRow = analytics.sponsor?.byDay.find(s => s.date === row.date);
                          const impressions = (sponsorRow?.wordyImpressions ?? 0) + (sponsorRow?.matchImpressions ?? 0);
                          const clicks = (sponsorRow?.wordyClicks ?? 0) + (sponsorRow?.matchClicks ?? 0);
                          const matchRow = analytics.match?.byDay.find(m => m.date === row.date);
                          return (
                            <tr key={row.date} className={i % 2 === 0 ? "" : "bg-gray-50/50"}>
                              <td className="px-4 py-2.5 text-xs text-gray-700 font-medium">{fmt(row.date)}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-900 text-center font-semibold">{row.plays}</td>
                              <td className="px-4 py-2.5 text-xs text-green-700 text-center font-medium">
                                {row.plays > 0 ? Math.round((row.wins / row.plays) * 100) : 0}%
                              </td>
                              <td className="px-4 py-2.5 text-xs text-center">
                                <span className={matchRow && matchRow.plays > 0 ? "text-gray-700 font-medium" : "text-gray-300"}>{matchRow?.plays ?? 0}</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-center">
                                <span className={impressions > 0 ? "text-gray-700 font-medium" : "text-gray-300"}>{impressions}</span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-center">
                                <span className={clicks > 0 ? "text-blue-600 font-medium" : "text-gray-300"}>{clicks}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
