"use client";

import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";

// Buyer bonus: printable Deal Savings Tracker.
// Unlisted page (not linked anywhere public): buyers get the link in their
// purchase confirmation email. Pairs with the One-Deal Promise: log every
// deal you use and watch the book pay for itself.
const ROWS = 24;

export default function SavingsTrackerPage() {
  const [amounts, setAmounts] = useState<string[]>(Array(ROWS).fill(""));
  const [dates, setDates] = useState<string[]>(Array(ROWS).fill(""));
  const [stores, setStores] = useState<string[]>(Array(ROWS).fill(""));
  const [deals, setDeals] = useState<string[]>(Array(ROWS).fill(""));

  const setAt = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    i: number,
    v: string
  ) => setter((prev) => prev.map((x, idx) => (idx === i ? v : x)));

  const total = amounts.reduce((sum, a) => {
    const n = parseFloat(a.replace(/[^0-9.]/g, ""));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const goalPct = Math.min(100, Math.round((total / 15) * 100));

  return (
    <div className="min-h-screen bg-[#faf8f4] print:bg-white">
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-10 print:py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2 print:hidden">
          The Gist Deals &middot; Buyer bonus
        </p>
        <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight mb-2">
          Deal Savings Tracker
        </h1>
        <p className="text-sm text-gray-600 mb-6 max-w-lg">
          Every time you use a deal from the book, log it here. When your
          total passes <strong className="text-gray-900">$15</strong>, the book
          has officially paid for itself. Everything after that is pure
          savings.
        </p>

        {/* Progress toward the One-Deal Promise */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 mb-6 print:break-inside-avoid">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-sm font-bold text-gray-900">
              Total saved so far:{" "}
              <span className="text-green-700 text-lg">
                ${total.toFixed(2)}
              </span>
            </p>
            <p className="text-xs text-gray-500">$15 goal</p>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {total >= 15
              ? "🎉 The book has paid for itself. Nice work."
              : `You're $${(15 - total).toFixed(2)} away from the book paying for itself.`}
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-100 text-left">
                <th className="px-3 py-2 font-bold text-gray-700 w-24">Date</th>
                <th className="px-3 py-2 font-bold text-gray-700">Store</th>
                <th className="px-3 py-2 font-bold text-gray-700">Deal used</th>
                <th className="px-3 py-2 font-bold text-gray-700 w-24 text-right">Saved</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROWS }).map((_, i) => (
                <tr key={i} className="border-t border-stone-100">
                  <td className="px-2 py-1.5">
                    <input
                      value={dates[i]}
                      onChange={(e) => setAt(setDates, i, e.target.value)}
                      
                      className="w-full bg-transparent px-1 py-1 text-[13px] focus:outline-none focus:bg-green-50 rounded print:hidden"
                    />
                    <span className="hidden print:inline text-[13px]">&nbsp;</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={stores[i]}
                      onChange={(e) => setAt(setStores, i, e.target.value)}
                      
                      className="w-full bg-transparent px-1 py-1 text-[13px] focus:outline-none focus:bg-green-50 rounded print:hidden"
                    />
                    <span className="hidden print:inline text-[13px]">&nbsp;</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={deals[i]}
                      onChange={(e) => setAt(setDeals, i, e.target.value)}
                      
                      className="w-full bg-transparent px-1 py-1 text-[13px] focus:outline-none focus:bg-green-50 rounded print:hidden"
                    />
                    <span className="hidden print:inline text-[13px]">&nbsp;</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={amounts[i]}
                      onChange={(e) => setAt(setAmounts, i, e.target.value)}
                      placeholder="$0.00"
                      inputMode="decimal"
                      className="w-full bg-transparent px-1 py-1 text-[13px] text-right focus:outline-none focus:bg-green-50 rounded print:hidden"
                    />
                    <span className="hidden print:inline text-[13px]">&nbsp;</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-green-700 hover:bg-green-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Print my tracker
          </button>
          <p className="text-xs text-gray-400">
            Tip: print a fresh copy each month and keep it on the fridge.
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-8 text-center print:hidden">
          Remember the One-Deal Promise: if you don&apos;t save at least $15 in
          your first 60 days, email us for a full refund. And keep the
          book.
        </p>
      </div>
    </div>
  );
}
