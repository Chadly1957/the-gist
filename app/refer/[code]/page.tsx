"use client";

import { useState, useEffect } from "react";
import Logo from "@/components/Logo";

interface SprintData {
  goal: number;
  endDate: string;
  prizeDescription?: string | null;
}

interface ReferralData {
  valid: boolean;
  referrerFirstName?: string | null;
  sprint?: SprintData | null;
  signupCount?: number;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function ReferralPage({ params }: { params: { code: string } }) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState<string | null | undefined>(undefined);
  const [nameInput, setNameInput] = useState("");
  const [nameExpanded, setNameExpanded] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/refer/${params.code}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setDisplayName(d.referrerFirstName ?? null);
        setNameInput(d.referrerFirstName ?? "");
      })
      .catch(() => setData({ valid: false }))
      .finally(() => setLoading(false));
  }, [params.code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/refer/${params.code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), firstName: firstName.trim() }),
      });
      const result = await res.json();
      if (res.ok) {
        if (result.alreadySubscribed) {
          setSubmitStatus("already");
        } else {
          setSubmitStatus("success");
        }
      } else {
        setErrorMsg(result.error || "Something went wrong.");
        setSubmitStatus("error");
      }
    } catch {
      setErrorMsg("Connection error. Please try again.");
      setSubmitStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    try {
      const res = await fetch(`/api/refer/${params.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: nameInput.trim() }),
      });
      if (res.ok) {
        setDisplayName(nameInput.trim() || null);
        setNameSaved(true);
        setNameExpanded(false);
        setTimeout(() => setNameSaved(false), 3000);
      }
    } finally {
      setNameSaving(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.valid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
          <Logo className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Referral Link</h1>
          <p className="text-gray-500 text-sm">This referral link is not valid. Check that you have the correct URL.</p>
        </div>
      </div>
    );
  }

  const { sprint, signupCount = 0 } = data;
  const currentName = displayName !== undefined ? displayName : data.referrerFirstName;
  const nameIsNumber = /^\d+$/.test(currentName || "");
  const progressPct = sprint ? Math.min(100, Math.round((signupCount / sprint.goal) * 100)) : 0;
  const remaining = sprint ? Math.max(0, sprint.goal - signupCount) : 0;

  if (submitStatus === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re subscribed!</h2>
          <p className="text-gray-500 text-sm">
            Welcome to The Gist Decatur.
            {data.referrerFirstName ? ` ${data.referrerFirstName} referred you — thanks to you both!` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (submitStatus === "already") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
          <Logo className="h-12 w-auto mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Already subscribed!</h2>
          <p className="text-gray-500 text-sm">You&apos;re already on The Gist Decatur list — no action needed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-green-800 px-8 py-8 text-center">
          <Logo className="h-14 w-auto mx-auto mb-3" />
          <p className="text-green-200 text-sm">Your daily Decatur briefing</p>
        </div>

        <div className="p-8">
          {/* Referrer name */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {currentName
                ? <>{currentName} invited you to The Gist Decatur</>
                : <>You&apos;ve been invited to The Gist Decatur</>}
            </h1>
            <p className="text-gray-500 text-sm">
              Sign up to get a daily email covering what&apos;s happening in Decatur — local news, events, and more.
            </p>
          </div>

          {/* Sprint progress (if active sprint) */}
          {sprint && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-green-800 uppercase tracking-wide">Referral Challenge</span>
                <span className="text-xs text-green-700">Ends {formatDate(sprint.endDate)}</span>
              </div>
              <div className="text-sm text-green-900 font-medium mb-1">
                {currentName ? `${currentName} has referred ` : ""}
                <span className="font-bold">{signupCount}</span> of <span className="font-bold">{sprint.goal}</span> people
              </div>
              <div className="w-full bg-green-200 rounded-full h-2 mb-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {remaining > 0 ? (
                <p className="text-xs text-green-700">
                  {remaining} more referral{remaining !== 1 ? "s" : ""} needed to reach the goal
                </p>
              ) : (
                <p className="text-xs text-green-700 font-semibold">Goal reached!</p>
              )}
              {sprint.prizeDescription && (
                <p className="text-xs text-green-600 mt-1">
                  <span className="font-semibold">Prize:</span> {sprint.prizeDescription}
                </p>
              )}
            </div>
          )}

          {/* Sign-up form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="firstName" className="block text-xs font-semibold text-gray-600 mb-1">
                First name <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-600 mb-1">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {submitStatus === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              {submitting ? "Subscribing…" : "Subscribe to The Gist Decatur"}
            </button>
          </form>

          {/* Copy link (for the referrer who visits their own link) */}
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 mb-2">Share this page with your friends</p>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? "Copied!" : "Copy referral link"}
            </button>
          </div>

          {/* Name update */}
          <div className="mt-4">
            {nameIsNumber && !nameExpanded && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-xs text-amber-800">
                  Your name is showing as <strong>&ldquo;{currentName}&rdquo;</strong> — want to fix that?
                </p>
                <button
                  onClick={() => { setNameExpanded(true); setNameInput(""); }}
                  className="text-xs font-semibold text-amber-700 underline whitespace-nowrap"
                >
                  Update name
                </button>
              </div>
            )}

            {!nameIsNumber && !nameExpanded && !nameSaved && (
              <div className="text-center">
                <button
                  onClick={() => setNameExpanded(true)}
                  className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                >
                  {currentName ? "Update your name" : "Add your name"}
                </button>
              </div>
            )}

            {nameSaved && !nameExpanded && (
              <p className="text-center text-xs text-green-700 font-medium">Name updated!</p>
            )}

            {nameExpanded && (
              <form onSubmit={saveName} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your first name"
                  maxLength={100}
                  autoFocus
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="submit"
                  disabled={nameSaving}
                  className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
                >
                  {nameSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => { setNameExpanded(false); setNameInput(currentName || ""); }}
                  className="text-gray-400 hover:text-gray-600 text-xs px-1"
                >
                  ✕
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
