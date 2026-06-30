"use client";

import { useEffect, useState, useCallback } from "react";
import UrlInput from "@/components/UrlInput";

interface WordEntry { id: string; date: string; word: string; puzzleNum: number; }
interface Booking { id: string; date: string; status: string; isPaid: boolean; adminNotes: string | null; headline: string; body: string; ctaUrl: string; ctaLabel: string; imageUrl: string | null; presentingBlurb: string | null; sponsorId: string; sponsor: { businessName: string; contactName: string; email: string }; }
interface SponsorProfile { id: string; businessName: string; }
interface Spotlight { sponsorId: string; businessName: string; logoUrl: string | null; description: string; ctaLabel: string; ctaUrl: string; status: string; }
interface PlayStats { plays: number; wins: number; sponsorViews: number; }
interface DayStats { date: string; plays: number; wins: number; sponsorViews: number; }
interface Analytics { allTime: PlayStats | null; today: PlayStats | null; thisWeek: PlayStats | null; byDay: DayStats[]; }

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return `${MONTHS[m-1]} ${d}, ${y}`;
}

function today() { return new Date().toLocaleDateString("en-CA"); }

export default function WordyAdminPage() {
  const [tab, setTab] = useState<"schedule" | "bookings" | "analytics">("schedule");

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

  // --- Bookings tab ---
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [sponsors, setSponsors]   = useState<SponsorProfile[]>([]);
  const [spotlightMap, setSpotlightMap] = useState<Map<string, Spotlight>>(new Map());
  const [editBooking, setEditBooking] = useState<Partial<Booking> & { date?: string } | null>(null);
  const [bookSaving, setBookSaving] = useState(false);
  const [bookError, setBookError]   = useState("");

  const monthKey = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;

  const loadWords = useCallback(() => {
    fetch(`/api/admin/wordy/words?month=${monthKey}`)
      .then(r => r.json())
      .then(d => setWords(d.words || []));
  }, [monthKey]);

  const loadBookings = useCallback(() => {
    fetch("/api/admin/wordy/bookings").then(r => r.json()).then(d => setBookings(d.bookings || []));
  }, []);

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
  useEffect(() => {
    loadBookings();
    fetch("/api/admin/sponsors")
      .then(r => r.json())
      .then(d => {
        setSponsors((d.profiles || []).filter((p: { active: boolean }) => p.active));
        // Build a map of sponsorId → their best approved spotlight for auto-fill
        const map = new Map<string, Spotlight>();
        for (const s of (d.spotlights || []) as Spotlight[]) {
          if (s.status === "approved" && !map.has(s.sponsorId)) map.set(s.sponsorId, s);
        }
        setSpotlightMap(map);
      });
  }, [loadBookings]);

  // Calendar helpers
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const wordMap = new Map(words.map(w => [w.date, w]));
  const bookingMap = new Map(bookings.map(b => [b.date, b]));

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

  async function saveBooking() {
    if (!editBooking?.date || !editBooking.sponsorId || !editBooking.headline) {
      setBookError("Date, sponsor, and headline are required."); return;
    }
    setBookSaving(true);
    setBookError("");
    const isNew = !editBooking.id;
    const url = isNew ? "/api/admin/wordy/bookings" : `/api/admin/wordy/bookings/${editBooking.id}`;
    const method = isNew ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editBooking),
    });
    const data = await res.json();
    if (!res.ok) { setBookError(data.error || "Save failed."); }
    else { loadBookings(); setEditBooking(null); }
    setBookSaving(false);
  }

  async function deleteBooking(id: string) {
    if (!confirm("Delete this Wordy booking?")) return;
    await fetch(`/api/admin/wordy/bookings/${id}`, { method: "DELETE" });
    loadBookings();
  }

  const todayStr = today();

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Decatur Wordy</h1>
        <p className="text-sm text-gray-500 mt-1">Schedule daily words and manage sponsor bookings.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        {(["schedule","bookings","analytics"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "schedule" ? "Word Schedule" : t === "bookings" ? "Sponsor Bookings" : "Analytics"}
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
                const booking = bookingMap.get(dateStr);
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
                      {booking && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-yellow-200" : booking.status === "approved" ? "bg-yellow-500" : "bg-orange-300"}`} title={booking.sponsor.businessName} />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-4 mt-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Word set</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Sponsored</span>
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

      {/* ── BOOKINGS TAB ── */}
      {tab === "bookings" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}</p>
            <button onClick={() => setEditBooking({ date: todayStr, ctaLabel: "Learn More" })}
              className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              + New Booking
            </button>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No Wordy sponsor bookings yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => (
                <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{fmt(b.date)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.status === "approved" ? "bg-green-50 text-green-700" : b.status === "rejected" ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-700"}`}>
                        {b.status === "pending_review" ? "Pending" : b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                      {b.isPaid && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Paid</span>}
                    </div>
                    <p className="text-xs text-gray-500">{b.sponsor.businessName} · {b.headline}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setEditBooking(b); setBookError(""); }}
                      className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">Edit</button>
                    <button onClick={() => deleteBooking(b.id)}
                      className="text-xs text-red-500 hover:text-red-700 border border-red-100 px-3 py-1.5 rounded-lg transition-colors">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === "analytics" && (
        <div>
          {analyticsLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !analytics?.allTime ? (
            <p className="text-sm text-gray-400 py-8 text-center">No play data yet — analytics will appear once people start playing.</p>
          ) : (
            <div className="space-y-6">
              {/* Period stat cards */}
              {[
                { label: "Today", stats: analytics.today },
                { label: "Last 7 Days", stats: analytics.thisWeek },
                { label: "All Time", stats: analytics.allTime },
              ].map(({ label, stats }) => stats && (
                <div key={label}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{stats.plays.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Games Played</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-700">
                        {stats.plays > 0 ? Math.round((stats.wins / stats.plays) * 100) : 0}%
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Win Rate</p>
                      <p className="text-xs text-gray-400">{stats.wins} wins</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {stats.plays > 0 ? Math.round((stats.sponsorViews / stats.plays) * 100) : 0}%
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">End-Screen Views</p>
                      <p className="text-xs text-gray-400">{stats.sponsorViews} views</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Per-day breakdown */}
              {analytics.byDay.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Last 30 Days</p>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left text-xs font-semibold text-gray-500 px-4 py-2.5">Date</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Plays</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Wins</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">Win %</th>
                          <th className="text-center text-xs font-semibold text-gray-500 px-4 py-2.5">End-Screen Views</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.byDay.map((row, i) => (
                          <tr key={row.date} className={i % 2 === 0 ? "" : "bg-gray-50/50"}>
                            <td className="px-4 py-2.5 text-xs text-gray-700 font-medium">{fmt(row.date)}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-900 text-center font-semibold">{row.plays}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 text-center">{row.wins}</td>
                            <td className="px-4 py-2.5 text-xs text-green-700 text-center font-medium">
                              {row.plays > 0 ? Math.round((row.wins / row.plays) * 100) : 0}%
                            </td>
                            <td className="px-4 py-2.5 text-xs text-center">
                              <span className={row.sponsorViews > 0 ? "text-blue-600 font-medium" : "text-gray-300"}>
                                {row.sponsorViews}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">End-screen views = sponsor ad seen (every completed game, win or lose).</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Booking modal */}
      {editBooking !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{editBooking.id ? "Edit" : "New"} Wordy Booking</h3>
              <button onClick={() => setEditBooking(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {bookError && <p className="text-sm text-red-500">{bookError}</p>}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                <input type="date" value={editBooking.date || ""} onChange={e => setEditBooking(b => ({ ...b!, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Sponsor</label>
                <select
                  value={editBooking.sponsorId || ""}
                  onChange={e => {
                    const id = e.target.value;
                    const spotlight = spotlightMap.get(id);
                    const profile = sponsors.find(s => s.id === id);
                    setEditBooking(b => ({
                      ...b!,
                      sponsorId: id,
                      // Auto-fill from their Community Partners listing if not already filled
                      headline: b?.headline || (profile ? `Visit ${profile.businessName}` : ""),
                      body: b?.body || spotlight?.description || "",
                      ctaUrl: b?.ctaUrl || spotlight?.ctaUrl || "",
                      ctaLabel: b?.ctaLabel || spotlight?.ctaLabel || "Learn More",
                      imageUrl: b?.imageUrl || spotlight?.logoUrl || "",
                      presentingBlurb: b?.presentingBlurb || (profile ? `Today's Decatur Wordy is brought to you by ${profile.businessName}.` : ""),
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select a sponsor…</option>
                  {sponsors.map(s => <option key={s.id} value={s.id}>{s.businessName}</option>)}
                </select>
                {editBooking.sponsorId && spotlightMap.has(editBooking.sponsorId) && (
                  <p className="text-xs text-green-600 mt-1">✓ Auto-filled from their Community Partners listing</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Opening blurb (optional)</label>
                <input type="text" value={editBooking.presentingBlurb || ""} onChange={e => setEditBooking(b => ({ ...b!, presentingBlurb: e.target.value }))}
                  placeholder="Today's Wordy is brought to you by…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Headline</label>
                <input type="text" value={editBooking.headline || ""} onChange={e => setEditBooking(b => ({ ...b!, headline: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Body</label>
                <textarea value={editBooking.body || ""} onChange={e => setEditBooking(b => ({ ...b!, body: e.target.value }))}
                  rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Label</label>
                  <input type="text" value={editBooking.ctaLabel || "Learn More"} onChange={e => setEditBooking(b => ({ ...b!, ctaLabel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CTA URL</label>
                  <UrlInput value={editBooking.ctaUrl || ""} onChange={v => setEditBooking(b => ({ ...b!, ctaUrl: v }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Image URL (optional)</label>
                <UrlInput value={editBooking.imageUrl || ""} onChange={v => setEditBooking(b => ({ ...b!, imageUrl: v }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={editBooking.status || "pending_review"} onChange={e => setEditBooking(b => ({ ...b!, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="pending_review">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="isPaid" checked={!!editBooking.isPaid} onChange={e => setEditBooking(b => ({ ...b!, isPaid: e.target.checked }))}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <label htmlFor="isPaid" className="text-sm font-medium text-gray-700">Paid</label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Admin Notes</label>
                <textarea value={editBooking.adminNotes || ""} onChange={e => setEditBooking(b => ({ ...b!, adminNotes: e.target.value }))}
                  rows={2} placeholder="Internal notes…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => setEditBooking(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveBooking} disabled={bookSaving}
                className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                {bookSaving ? "Saving…" : "Save Booking"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
