"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";
import { workspaceFetch } from "@/lib/workspace-client";
import {
  BOARD_CATEGORIES,
  BOARD_INTENTS,
  BOARD_PRICE_CENTS,
  BOARD_RUN_WEEK_OPTIONS,
  boardRunPriceCents,
  boardRunWeeksLabel,
  boardIntentForKey,
} from "@/lib/board-constants";

function BoardPostForm() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";
  const preselected = boardIntentForKey(searchParams.get("intent"));
  const [step, setStep] = useState<1 | 2>(preselected ? 2 : 1);
  const [intent, setIntent] = useState<string | null>(preselected?.key ?? null);
  // Prefill from an event submission (?title=&description=&link=), truncated
  // to the form's own limits. Works with or without ?intent=.
  const [title, setTitle] = useState((searchParams.get("title") ?? "").slice(0, 80));
  const [description, setDescription] = useState((searchParams.get("description") ?? "").slice(0, 200));
  const [category, setCategory] = useState<string>(preselected?.category ?? BOARD_CATEGORIES[0].key);
  const [linkUrl, setLinkUrl] = useState(searchParams.get("link") ?? "");
  const [contactInfo, setContactInfo] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [runWeeks, setRunWeeks] = useState<number>(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profilePrefilled, setProfilePrefilled] = useState(false);
  const prefillTried = useRef(false);

  // Prefill from the sponsor's PROFILE (?token=, linked from the sponsor
  // portal): the business already gave us its name, link, email, phone
  // and description, so they just write the post and pay. Event params
  // (?title=&description=&link=) win where both are present, and the
  // title is always the post's own (there is no post title on a
  // profile), so it stays blank for them to write.
  useEffect(() => {
    const token = searchParams.get("token");
    if (!token || prefillTried.current) return;
    prefillTried.current = true;
    (async () => {
      try {
        const res = await workspaceFetch(`/api/sponsor/portal?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        const p = data?.profile;
        if (!p) return;
        if (!searchParams.get("link") && p.website) setLinkUrl(p.website);
        if (!searchParams.get("description") && p.description) {
          setDescription(p.description.slice(0, 200));
        }
        if (p.email) setEmail((v) => v || p.email);
        if (p.phone) setContactInfo((v) => v || p.phone);
        if (p.businessName) setDisplayName((v) => v || p.businessName);
        setProfilePrefilled(true);
      } catch {
        // Prefill is a convenience; the form still works blank.
      }
    })();
  }, [searchParams]);

  const intentDef = boardIntentForKey(intent);

  function pickIntent(key: string) {
    setIntent(key);
    const def = boardIntentForKey(key);
    if (def) setCategory(def.category);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Give your post a title.");
    if (!description.trim()) return setError("Add a short description.");
    if (!linkUrl.trim() && !contactInfo.trim()) {
      return setError("Add a link or a way to contact you, so readers can respond.");
    }
    if (!email.trim() || !email.includes("@")) return setError("A valid email is required for your receipt.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/board/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          intent: intent ?? "",
          linkUrl: linkUrl.trim(),
          contactInfo: contactInfo.trim(),
          displayName: displayName.trim(),
          email: email.trim(),
          runWeeks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-10 sm:py-14 w-full">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2">Post on the Gist Board</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your post runs in the newsletter and on the Board page for as long as you
              choose, at just ${(BOARD_PRICE_CENTS / 100).toFixed(0)} per week. No meetings,
              no pitches, just post it.
            </p>
          </div>

          {cancelled && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Checkout was cancelled. Your post was not saved and you were not charged.
            </p>
          )}

          {profilePrefilled && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
              Filled in from your sponsor profile — edit anything before posting.
            </p>
          )}

          {step === 1 ? (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">What would you like to share?</p>
              <p className="text-xs text-gray-500 mb-4">
                Pick one and we will tailor the form. Same Board post either way, ${(
                  BOARD_PRICE_CENTS / 100
                ).toFixed(0)} per week, and you pick how many weeks on the next step.
              </p>
              <div className="space-y-3">
                {BOARD_INTENTS.map((opt) => {
                  const selected = intent === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => pickIntent(opt.key)}
                      aria-pressed={selected}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        selected
                          ? "bg-green-50 border-green-600"
                          : "bg-gray-50 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">{opt.label}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">{opt.blurb}</span>
                      </span>
                      <span
                        className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                          selected ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-300 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={!intent}
                onClick={() => setStep(2)}
                className="w-full mt-5 bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Continue
              </button>
              <Link href="/board" className="block text-center text-xs text-gray-400 hover:text-gray-600 transition-colors mt-4">
                ← Back to the Board
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {intentDef && (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  You are sharing: <strong className="text-gray-700">{intentDef.label}</strong>{" "}
                  <button type="button" onClick={() => setStep(1)} className="text-green-700 font-semibold hover:underline ml-1">
                    Change
                  </button>
                </p>
              )}
              <div>
                <label htmlFor="board-title" className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                <input
                  id="board-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={intentDef?.titlePlaceholder ?? "e.g. Oak dining table, seats 6"}
                  maxLength={80}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="board-description" className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea
                  id="board-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={intentDef?.descriptionPlaceholder ?? "A line or two: condition, price, when, where."}
                  maxLength={200}
                  rows={3}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="board-category" className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select
                  id="board-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputCls}
                >
                  {BOARD_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="board-link" className="block text-xs font-semibold text-gray-600 mb-1">Link <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  id="board-link"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="board-contact" className="block text-xs font-semibold text-gray-600 mb-1">Contact info <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  id="board-contact"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="Phone, email, or how to reach you"
                  maxLength={120}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">Add a link or contact info (or both) so readers can respond.</p>
              </div>
              <div>
                <label htmlFor="board-name" className="block text-xs font-semibold text-gray-600 mb-1">Display name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  id="board-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Shown as “Posted by …” (leave blank to stay anonymous)"
                  maxLength={40}
                  className={inputCls}
                />
              </div>
              <div>
                <span className="block text-xs font-semibold text-gray-600 mb-1">How long should it run?</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Run length">
                  {BOARD_RUN_WEEK_OPTIONS.map((weeks) => {
                    const selected = runWeeks === weeks;
                    return (
                      <button
                        key={weeks}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setRunWeeks(weeks)}
                        className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                          selected
                            ? "bg-green-50 border-green-600"
                            : "bg-gray-50 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-gray-900">
                          {boardRunWeeksLabel(weeks)}
                        </span>
                        <span className="block text-xs text-gray-500">
                          ${(boardRunPriceCents(weeks) / 100).toFixed(0)} total · {weeks * 7} days
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="board-email" className="block text-xs font-semibold text-gray-600 mb-1">Your email</label>
                <input
                  id="board-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="For your receipt"
                  className={inputCls}
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                {submitting ? "Redirecting to checkout…" : `Post it — $${(boardRunPriceCents(runWeeks) / 100).toFixed(0)} for ${boardRunWeeksLabel(runWeeks)}`}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Your post goes live as soon as payment clears. Anything inappropriate may be removed and refunded.
              </p>
              <Link href="/board" className="block text-center text-xs text-gray-400 hover:text-gray-600 transition-colors">
                ← Back to the Board
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BoardPostPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <BoardPostForm />
    </Suspense>
  );
}
