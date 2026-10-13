"use client";

import { useState } from "react";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";

// Post-signup one-time offer for The Gist Deals book.
// Shown in place of the old soft "One more thing..." module, in the signup
// success state. Framed as a separate thing Chad built, never as part of the
// free newsletter. The bonus bundle (Friday Deal Drop + Savings Tracker) is
// only presented in this flow, which is what makes the page-bound urgency
// honest: /deals sells the book alone.
export default function DealsOto({
  area,
  email,
  src,
}: {
  area: string;
  email: string;
  src: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const href =
    `/deals?src=${encodeURIComponent(src)}` +
    (email ? `&email=${encodeURIComponent(email)}` : "");

  return (
    <div className="mt-5 max-w-md rounded-2xl border-2 border-green-600 bg-white p-6 shadow-lg">
      <p className="text-[11px] font-bold uppercase tracking-widest text-green-700 mb-2">
        Wait &mdash; one-time offer for new subscribers
      </p>

      <h3 className="text-xl font-extrabold text-gray-900 leading-tight mb-2">
        Save real money at places you already shop in {area} &mdash; starting
        this week.
      </h3>
      <p className="text-sm text-gray-600 mb-5">
        Separately from the free newsletter, I built{" "}
        <strong className="text-gray-900">The Gist Deals</strong>: a digital
        book of real discounts from local {area} businesses, right on your
        phone. One deal pays for the whole book.
      </p>

      {/* Value stack */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
          Here&apos;s everything you get
        </p>
        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="text-lg shrink-0">📕</span>
            <div>
              <p className="font-bold text-gray-900">The Gist Deals book</p>
              <p className="text-gray-600 text-[13px] leading-snug">
                Weekly store deals, local coupons with QR codes, and the 10
                best deals &mdash; refreshed every Monday.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-lg shrink-0">🎁</span>
            <div>
              <p className="font-bold text-gray-900">
                Bonus: The Friday Deal Drop{" "}
                <span className="font-semibold text-gray-500">($29 value)</span>
              </p>
              <p className="text-gray-600 text-[13px] leading-snug">
                Buyers-only weekly email &mdash; the week&apos;s best new
                deals, before the weekend.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-lg shrink-0">🎁</span>
            <div>
              <p className="font-bold text-gray-900">
                Bonus: Deal Savings Tracker{" "}
                <span className="font-semibold text-gray-500">($19 value)</span>
              </p>
              <p className="text-gray-600 text-[13px] leading-snug">
                A printable tracker that adds up every dollar you save &mdash;
                proof the book pays for itself.
              </p>
            </div>
          </li>
        </ul>
        <div className="border-t border-gray-200 mt-4 pt-3 flex items-baseline justify-between">
          <p className="text-sm text-gray-500">
            Total value <span className="line-through">$63</span>
          </p>
          <p className="text-lg font-extrabold text-gray-900">
            Today: $15 <span className="text-sm font-semibold text-gray-500">once, yours for life</span>
          </p>
        </div>
      </div>

      {/* Guarantee */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-bold text-green-900 mb-1">
          🛡️ The One-Deal Promise
        </p>
        <p className="text-[13px] text-green-800 leading-relaxed">
          If you don&apos;t save at least $15 with the book in your first 60
          days, just email me and I&apos;ll refund every cent &mdash; and you
          keep the book.
        </p>
      </div>

      <WorkspaceAnchor
        href={href}
        className="flex items-center justify-center gap-2 w-full bg-green-700 hover:bg-green-800 text-white font-bold px-5 py-3.5 rounded-xl text-[15px] transition-colors mb-2"
      >
        Get Instant Access &mdash; $15 Once
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </WorkspaceAnchor>
      <p className="text-xs text-gray-400 text-center mb-3">
        One-time payment &middot; No subscription &middot; Less than one pizza night
      </p>
      <p className="text-xs text-gray-500 text-center mb-4">
        This bonus bundle is only offered on this page, right after you join.
      </p>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="w-full text-center text-[13px] text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
      >
        No thanks, I&apos;ll stick with the free newsletter
      </button>
    </div>
  );
}
