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

export default function CashierRedeem({ buyerToken, coupons }: { buyerToken: string; coupons: Coupon[] }) {
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [done, setDone] = useState<{ couponTitle: string; businessName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function redeem(couponId: string) {
    setRedeeming(couponId);
    setError(null);
    try {
      const res = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerToken, couponId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Redemption failed.");
      setDone({ couponTitle: data.couponTitle, businessName: data.businessName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redemption failed.");
    } finally {
      setRedeeming(null);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">Redeemed</h1>
          <p className="text-gray-700 font-semibold">{done.couponTitle}</p>
          <p className="text-gray-500 text-sm mt-1">{done.businessName}</p>
          <p className="text-gray-500 text-sm mt-4">
            Apply the discount at the register however you normally would.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-center my-4">Gist Coupon Book</h1>
        <p className="text-center text-gray-500 text-sm mb-4">
          Tap the coupon the customer is using, then apply the discount at the register.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
        )}
        <div className="space-y-3">
          {coupons.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{c.businessName}</p>
              <p className="font-bold text-lg">{c.title}</p>
              {c.description && <p className="text-gray-600 text-sm mt-1">{c.description}</p>}
              {c.terms && <p className="text-gray-400 text-xs mt-1">{c.terms}</p>}
              <p className="text-gray-400 text-xs mt-1">
                {c.maxRedemptions === 1 ? "One-time use" : "Reusable"}
              </p>
              <button
                onClick={() => redeem(c.id)}
                disabled={redeeming !== null}
                className="mt-3 w-full py-4 rounded-xl bg-green-700 text-white text-xl font-bold disabled:opacity-50"
              >
                {redeeming === c.id ? "Redeeming…" : "Redeem"}
              </button>
            </div>
          ))}
        </div>
        {coupons.length === 0 && (
          <p className="text-center text-gray-500 mt-8">No coupons available right now.</p>
        )}
      </div>
    </div>
  );
}
