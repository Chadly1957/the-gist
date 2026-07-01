"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goal: number;
  prizeDescription: string | null;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function daysLeft(endDate: string): number {
  const [y, m, d] = endDate.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}

export default function ContestPage() {
  const [sprint, setSprint] = useState<Sprint | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refLink, setRefLink] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/contest")
      .then((r) => r.json())
      .then((d) => setSprint(d.sprint ?? null))
      .catch(() => setSprint(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/contest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setRefLink(data.refLink);
        setIsNew(data.isNew);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink() {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const loading = sprint === undefined;
  const days = sprint ? daysLeft(sprint.endDate) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="border-b border-green-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <Logo className="h-7 w-auto" />
          </Link>
          <Link
            href="/"
            className="text-sm text-green-700 font-medium hover:text-green-800 transition-colors"
          >
            Read the newsletter →
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : sprint === null ? (
          /* No active contest */
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              No Active Giveaway Right Now
            </h1>
            <p className="text-gray-500 mb-6">
              Check back soon — new contests drop regularly for Gist Decatur readers.
            </p>
            <Link
              href="/"
              className="inline-block bg-green-700 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-green-800 transition-colors"
            >
              Subscribe to The Gist Decatur
            </Link>
          </div>
        ) : refLink ? (
          /* Success — show referral link */
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-5">
              🎉 You&apos;re in!
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {isNew ? "You're subscribed — now share your link!" : "Here's your referral link!"}
            </h1>
            <p className="text-gray-500 text-sm mb-7">
              Share this link with friends. Every time someone subscribes using it,
              you get credit toward the prize.
            </p>

            {/* Referral link box */}
            <div className="bg-white border-2 border-green-200 rounded-xl p-4 mb-4 text-left">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Your referral link
              </p>
              <p className="text-sm font-mono text-gray-800 break-all leading-relaxed">
                {refLink}
              </p>
            </div>

            <button
              onClick={copyLink}
              className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-xl transition-colors mb-3 text-sm"
            >
              {copied ? "✓ Copied!" : "Copy My Referral Link"}
            </button>

            <div className="flex gap-2">
              <a
                href={`sms:?body=${encodeURIComponent("Join The Gist Decatur — Decatur's local newsletter! Sign up with my link: " + refLink)}`}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition-colors text-sm text-center"
              >
                Text a Friend
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent("Check out The Gist Decatur!")}&body=${encodeURIComponent("Join The Gist Decatur — Decatur's local newsletter!\n\nSign up here: " + refLink)}`}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition-colors text-sm text-center"
              >
                Send an Email
              </a>
            </div>

            {/* Contest summary */}
            <div className="mt-8 bg-white border border-gray-100 rounded-xl p-5 text-left">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Contest Details
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Contest</span>
                  <span className="font-semibold text-gray-800">{sprint.name}</span>
                </div>
                {sprint.prizeDescription && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Prize</span>
                    <span className="font-semibold text-gray-800">{sprint.prizeDescription}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Deadline</span>
                  <span className="font-semibold text-gray-800">{formatDate(sprint.endDate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Goal</span>
                  <span className="font-semibold text-gray-800">
                    Refer {sprint.goal} friends to qualify
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Main form */
          <>
            {/* Contest header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
                🎁 Giveaway
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
                {sprint.name}
              </h1>
              {sprint.prizeDescription && (
                <div className="inline-block bg-yellow-50 border border-yellow-200 text-yellow-800 font-semibold text-sm px-4 py-2 rounded-xl mb-4">
                  Prize: {sprint.prizeDescription}
                </div>
              )}
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                <span>
                  Ends{" "}
                  <span className="font-semibold text-gray-700">
                    {formatDate(sprint.endDate)}
                  </span>
                </span>
                {days > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span>
                      <span className="font-semibold text-green-700">{days}</span>{" "}
                      {days === 1 ? "day" : "days"} left
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* How it works */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
                How It Works
              </p>
              <div className="space-y-3">
                {[
                  { step: "1", text: "Enter your email below to get your unique referral link" },
                  { step: "2", text: `Share your link — every new subscriber counts as one referral` },
                  { step: "3", text: `Refer ${sprint.goal} friends by ${formatDate(sprint.endDate)} to qualify for the drawing` },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-700 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {step}
                    </div>
                    <p className="text-sm text-gray-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
              >
                {submitting ? "Getting your link…" : "Get My Referral Link →"}
              </button>
            </form>

            <p className="text-xs text-center text-gray-400 mt-4">
              Already a subscriber? Enter your email to get your link.
              <br />
              By entering your email you agree to receive The Gist Decatur newsletter.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
