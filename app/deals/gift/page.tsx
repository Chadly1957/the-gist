"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { workspaceFetch } from "@/lib/workspace-client";
import { COUPON_BOOK_PRICE_CENTS } from "@/lib/coupon-book";
import SiteHeader from "@/components/SiteHeader";

function cents(n: number) {
  return `$${(n / 100).toFixed(2).replace(/\.00$/, "")}`;
}

function GiftFormInner() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";
  const [recipientEmail, setRecipientEmail] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [gifterName, setGifterName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [buying, setBuying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const valid =
    recipientEmail.includes("@") && buyerEmail.includes("@") && giftMessage.length <= 280;

  async function buy() {
    setBuying(true);
    setFormError(null);
    try {
      const res = await workspaceFetch("/api/coupons/gift-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail, buyerEmail, gifterName, giftMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Checkout failed.");
      setBuying(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8f4]">
      <SiteHeader />
      <div className="max-w-md mx-auto px-4 pt-12 pb-12">
        <Link href="/deals" className="text-sm text-green-700 underline">
          &larr; Back to Gist Deals
        </Link>
        <div className="text-center mt-6 mb-6">
          <p className="text-4xl mb-3">🎁</p>
          <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight">Gift the Gist Deals Book</h1>
          <p className="text-gray-600 mt-3">
            Give someone every deal worth knowing about. {cents(COUPON_BOOK_PRICE_CENTS)} covers their
            first year. They get the book by email, you get the receipt. When the year ends,
            they can renew or let it lapse, their call.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
          {cancelled && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mb-4 text-sm">
              Checkout was cancelled. No charge was made.
            </div>
          )}
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{formError}</div>
          )}

          <label className="block text-sm font-semibold mb-1" htmlFor="gift-recipient">
            Their email <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-1.5">This is where their book link goes.</p>
          <input
            id="gift-recipient"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="friend@example.com"
            className="w-full border rounded-lg px-3 py-2 mb-4"
          />

          <label className="block text-sm font-semibold mb-1" htmlFor="gift-buyer">
            Your email <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-1.5">For your payment receipt.</p>
          <input
            id="gift-buyer"
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border rounded-lg px-3 py-2 mb-4"
          />

          <label className="block text-sm font-semibold mb-1" htmlFor="gift-name">
            Your name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <p className="text-xs text-gray-500 mb-1.5">Shown to them in the gift email.</p>
          <input
            id="gift-name"
            type="text"
            value={gifterName}
            onChange={(e) => setGifterName(e.target.value)}
            placeholder="From Santa"
            maxLength={80}
            className="w-full border rounded-lg px-3 py-2 mb-4"
          />

          <label className="block text-sm font-semibold mb-1" htmlFor="gift-message">
            Gift message <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="gift-message"
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value)}
            placeholder="Happy holidays! Thought you'd love this."
            maxLength={280}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 mb-1"
          />
          <p className="text-xs text-gray-400 mb-4 text-right">{giftMessage.length}/280</p>

          <button
            onClick={buy}
            disabled={buying || !valid}
            className="w-full py-3 rounded-xl bg-green-700 text-white font-bold disabled:opacity-50"
          >
            {buying ? "Starting checkout…" : `Send the gift — ${cents(COUPON_BOOK_PRICE_CENTS)}`}
          </button>
          <p className="text-xs text-gray-400 mt-3 text-center">
            One payment covers their first year. No charge to them, ever, unless they choose to
            renew. The One-Deal Promise applies.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function GiftDealsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading…</p></div>}>
      <GiftFormInner />
    </Suspense>
  );
}
