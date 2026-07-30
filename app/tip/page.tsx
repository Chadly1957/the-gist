"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

const PRESETS = [3, 5, 10];
const VALID_SOURCES = ["web", "newsletter", "wordy", "match"];

function TipForm() {
  const searchParams = useSearchParams();
  const presetAmount = Number(searchParams.get("amount"));
  const initialAmount = PRESETS.includes(presetAmount) ? presetAmount : 3;
  const rawSource = searchParams.get("source") || "web";
  const source = VALID_SOURCES.includes(rawSource) ? rawSource : "web";
  const justPaid = searchParams.get("success") === "1";
  const cancelled = searchParams.get("cancelled") === "1";

  const [amount, setAmount] = useState<number>(initialAmount);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedAmount = isCustom ? Math.round((parseFloat(customAmount) || 0) * 100) / 100 : amount;

  async function submitTip() {
    setError("");
    const amountCents = Math.round(selectedAmount * 100);
    if (!amountCents || amountCents < 100) {
      setError("Please enter at least $1.");
      return;
    }
    if (amountCents > 50000) {
      setError("That's a huge tip! Please enter $500 or less.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tip/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Connection error. Please try again.");
      setSubmitting(false);
    }
  }

  if (justPaid) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <Link href="/" className="mb-6"><Logo className="h-12 w-auto" /></Link>
        <p className="text-4xl mb-3">☕</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Thank you so much!</h1>
        <p className="text-sm text-gray-500 max-w-xs">
          Your tip means a lot and helps keep The Gist Decatur going. We really appreciate you.
        </p>
        <Link href="/" className="mt-6 text-sm text-green-700 font-semibold hover:underline">← Back to The Gist Decatur</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 py-12">
      <Link href="/" className="mb-8"><Logo className="h-12 w-auto" /></Link>
      <div className="w-full max-w-sm text-center">
        <p className="text-4xl mb-3">☕</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Support The Gist Decatur</h1>
        <p className="text-sm text-gray-500 mb-6">
          Like what we&apos;re doing? Leave a tip to help keep local, independent news going strong.
        </p>

        {cancelled && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            No worries — your card wasn&apos;t charged. Tip whenever you&apos;re ready.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setIsCustom(false); setAmount(p); }}
              className={`py-3 rounded-xl text-sm font-bold border transition-colors ${
                !isCustom && amount === p
                  ? "bg-green-700 border-green-700 text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              ${p}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsCustom(true)}
          className={`w-full flex items-center gap-2 border rounded-xl px-3 py-2.5 mb-4 transition-colors ${
            isCustom ? "border-green-700 ring-1 ring-green-700" : "border-gray-200"
          }`}
        >
          <span className="text-sm font-semibold text-gray-500">$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Custom amount"
            value={customAmount}
            onFocus={() => setIsCustom(true)}
            onChange={(e) => {
              setIsCustom(true);
              setCustomAmount(e.target.value.replace(/[^0-9.]/g, ""));
            }}
            className="flex-1 text-sm outline-none text-left"
          />
        </button>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          type="button"
          onClick={submitTip}
          disabled={submitting}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
        >
          {submitting ? "Redirecting…" : `Tip $${selectedAmount || 0}`}
        </button>

        <Link href="/" className="mt-6 inline-block text-xs text-gray-400 hover:text-gray-600 transition-colors">
          ← Back to The Gist Decatur
        </Link>
      </div>
    </div>
  );
}

export default function TipPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-green-600 border-t-transparent" /></div>}>
      <TipForm />
    </Suspense>
  );
}
