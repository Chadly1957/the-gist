"use client";

import { useState } from "react";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";

// Post-signup one-time offer for The Gist Deals book.
// Shown in the signup success state. The offer is simple on purpose: the
// book, $15 a year, backed by the One-Deal Promise. No bundles, no bonus
// stack, no manufactured urgency.
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
        One-time offer for new subscribers
      </p>

      <h3 className="text-xl font-extrabold text-gray-900 leading-tight mb-2">
        Save real money at places you already shop in {area}, starting this
        week.
      </h3>
      <p className="text-sm text-gray-600 mb-5">
        Separately from the free newsletter, I built{" "}
        <strong className="text-gray-900">The Gist Deals</strong>: a digital
        book of real discounts from local {area} businesses, right on your
        phone.
      </p>

      {/* What's inside */}
      <ul className="space-y-2.5 text-sm mb-5">
        {[
          "Weekly grocery deals from stores like Aldi, Kroger, and Dollar General",
          "Real coupons from local businesses, with QR codes you flash at checkout",
          "The 10 best deals, hand-picked every Monday",
        ].map((item) => (
          <li key={item} className="flex gap-2.5 text-gray-700">
            <span className="text-green-700 font-bold shrink-0">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-gray-600 mb-1">
        <strong className="text-gray-900 text-base">$15 a year.</strong>{" "}
        One grocery run usually covers it.
      </p>
      <p className="text-[13px] text-gray-500 mb-4">
        Buyers also get the Friday Deal Drop email and a printable savings
        tracker.
      </p>

      {/* Guarantee */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-bold text-green-900 mb-1">
          The One-Deal Promise
        </p>
        <p className="text-[13px] text-green-800 leading-relaxed">
          If you don&apos;t save at least $15 with the book in your first 60
          days, just email me and I&apos;ll refund every cent. You keep the
          book.
        </p>
      </div>

      <WorkspaceAnchor
        href={href}
        className="flex items-center justify-center gap-2 w-full bg-green-700 hover:bg-green-800 text-white font-bold px-5 py-3.5 rounded-xl text-[15px] transition-colors mb-2"
      >
        Get the Book, $15 a year
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </WorkspaceAnchor>
      <p className="text-xs text-gray-400 text-center mb-4">
        Renews yearly. Cancel anytime. You only see this offer right after
        joining.
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
