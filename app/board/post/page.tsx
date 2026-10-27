"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";
import { BOARD_CATEGORIES, BOARD_PRICE_CENTS, BOARD_RUN_DAYS } from "@/lib/board-constants";

function BoardPostForm() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(BOARD_CATEGORIES[0].key);
  const [linkUrl, setLinkUrl] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          linkUrl: linkUrl.trim(),
          contactInfo: contactInfo.trim(),
          displayName: displayName.trim(),
          email: email.trim(),
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
              Your post runs in the newsletter and on the Board page for {BOARD_RUN_DAYS} days,
              for just ${(BOARD_PRICE_CENTS / 100).toFixed(0)}. No meetings, no pitches, just post it.
            </p>
          </div>

          {cancelled && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Checkout was cancelled. Your post was not saved and you were not charged.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="board-title" className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
              <input
                id="board-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Oak dining table, seats 6"
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
                placeholder="A line or two: condition, price, when, where."
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
              {submitting ? "Redirecting to checkout…" : `Post it — $${(BOARD_PRICE_CENTS / 100).toFixed(0)} for ${BOARD_RUN_DAYS} days`}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Posts are reviewed before they run in the newsletter. Anything inappropriate is rejected and refunded.
            </p>
            <Link href="/board" className="block text-center text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← Back to the Board
            </Link>
          </form>
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
