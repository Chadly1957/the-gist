"use client";

import { useState } from "react";

interface Coupon {
  id: string;
  businessName: string;
  title: string;
  description: string;
  terms: string;
  maxRedemptions: number | null;
}

export default function RedeemClient({
  buyerToken,
  buyerEmail,
  coupon,
  usedUp,
}: {
  buyerToken: string;
  buyerEmail: string;
  coupon: Coupon;
  usedUp: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (confirming || done) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerToken, couponId: coupon.id, notes: notes.trim().slice(0, 500) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not log the redemption.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log the redemption.");
    } finally {
      setConfirming(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2">Redemption logged</h1>
          <p className="text-gray-600 text-sm">
            {coupon.title} at {coupon.businessName} — the business has been notified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{coupon.businessName}</p>
        <h1 className="text-2xl font-bold mb-2">{coupon.title}</h1>
        {coupon.description && <p className="text-gray-600 text-sm mb-2">{coupon.description}</p>}
        {coupon.terms && <p className="text-gray-400 text-xs mb-4">{coupon.terms}</p>}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs text-gray-600">
          <p>
            <span className="font-semibold">Buyer:</span> {buyerEmail}
          </p>
          <p>
            <span className="font-semibold">When:</span> {new Date().toLocaleString()}
          </p>
        </div>
        {usedUp ? (
          <p className="text-red-600 text-sm font-semibold text-center">This coupon has already been used up.</p>
        ) : (
          <>
            <label className="block text-sm font-semibold mb-1" htmlFor="redeem-notes">
              Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="redeem-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you want to add…"
              rows={3}
              maxLength={500}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
            />
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <button
              onClick={confirm}
              disabled={confirming}
              className="w-full bg-green-700 text-white font-semibold rounded-xl py-3 disabled:opacity-50"
            >
              {confirming ? "Logging…" : "Confirm redemption"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
