"use client";

import { Suspense, useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { useSearchParams } from "next/navigation";
import { COUPON_BOOK_PRICE_CENTS } from "@/lib/coupon-book";

interface BookCoupon {
  id: string;
  businessName: string;
  title: string;
  description: string;
  terms: string;
  maxRedemptions: number | null;
  redemptionsByMe: number;
  usedUp: boolean;
}

interface BookDeal {
  title: string;
  price?: string | null;
  businessName?: string | null;
  dealUrl?: string | null;
  isTopPick: boolean;
}

interface BookRetailerDeals {
  displayName: string;
  deals: BookDeal[];
}

interface BookData {
  email: string;
  dealsLogoUrl?: string | null;
  qrDataUrl: string;
  coupons: BookCoupon[];
  deals?: {
    topPicks: BookDeal[];
    retailers: BookRetailerDeals[];
    weekLabel: string;
  };
  referrals?: {
    rakuten: string;
    ibotta: string;
    note: string;
  };
}

function cents(n: number) {
  return `$${(n / 100).toFixed(2).replace(/\.00$/, "")}`;
}

function CouponsPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [book, setBook] = useState<BookData | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [buying, setBuying] = useState(false);
  const [linkSent, setLinkSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const priceCents = COUPON_BOOK_PRICE_CENTS;

  useEffect(() => {
    if (!token) return;
    workspaceFetch(`/api/coupons/book?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not open your book.");
        setBook(data);
      })
      .catch((e) => setBookError(e instanceof Error ? e.message : "Could not open your book."));
  }, [token]);

  async function buy() {
    setBuying(true);
    setFormError(null);
    try {
      const res = await workspaceFetch("/api/coupons/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Checkout failed.");
      setBuying(false);
    }
  }

  async function resendLink() {
    setFormError(null);
    setLinkSent(null);
    try {
      const res = await workspaceFetch("/api/coupons/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setLinkSent(data.message);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  // Logged-in book view.
  if (token) {
    if (bookError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-bold mb-2">Link not valid</h1>
            <p className="text-gray-600 text-sm">{bookError}</p>
          </div>
        </div>
      );
    }
    if (!book) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Opening your book…</p></div>;
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          {book.dealsLogoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={book.dealsLogoUrl} alt="The Gist Deals" className="mx-auto h-14 w-auto mt-4" />
          )}
          <h1 className="text-2xl font-bold text-center mt-4">My Gist Deals Book</h1>
          <p className="text-center text-gray-500 text-sm mb-4">{book.email}</p>
          <div className="bg-white rounded-2xl shadow p-6 text-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={book.qrDataUrl} alt="Your Gist Deals Book QR code" className="mx-auto w-56 h-56" />
          </div>
          {book.deals && (book.deals.topPicks.length > 0 || book.deals.retailers.length > 0) && (
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1">This Week&apos;s Deals</h2>
              {book.deals.weekLabel && (
                <p className="text-gray-500 text-xs mb-3">{book.deals.weekLabel}</p>
              )}
              {book.deals.topPicks.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
                  <p className="font-bold text-sm mb-2">⭐ Top picks</p>
                  <ul className="space-y-1.5">
                    {book.deals.topPicks.map((d, i) => (
                      <li key={i} className="text-sm">
                        {d.businessName && <span className="text-gray-500">{d.businessName}: </span>}
                        <span className="font-medium">{d.title}</span>
                        {d.price && <span className="font-bold"> {d.price}</span>}
                        {d.dealUrl && (
                          <a href={d.dealUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline ml-1">
                            view →
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {book.deals.retailers.map((r) => (
                <div key={r.displayName} className="bg-white rounded-xl shadow p-4 mb-3">
                  <p className="font-bold text-sm mb-2">{r.displayName}</p>
                  <ul className="space-y-1.5">
                    {r.deals
                      .filter((d) => !d.isTopPick)
                      .slice(0, 12)
                      .map((d, i) => (
                        <li key={i} className="text-sm text-gray-700">
                          {d.businessName && <span className="text-gray-500">{d.businessName}: </span>}
                          {d.title}
                          {d.price && <span className="font-bold"> {d.price}</span>}
                          {d.dealUrl && (
                            <a href={d.dealUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline ml-1">
                              view →
                            </a>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
              {(book.referrals?.rakuten || book.referrals?.ibotta) && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
                  <p className="font-bold text-sm mb-1">💰 Stack your savings</p>
                  {book.referrals.note && <p className="text-xs text-gray-600 mb-2">{book.referrals.note}</p>}
                  <p className="text-xs">
                    {book.referrals.rakuten && (
                      <a href={book.referrals.rakuten} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                        Get cash back with Rakuten
                      </a>
                    )}
                    {book.referrals.rakuten && book.referrals.ibotta && " · "}
                    {book.referrals.ibotta && (
                      <a href={book.referrals.ibotta} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                        Get the Ibotta app
                      </a>
                    )}
                  </p>
                </div>
              )}
              <p className="text-gray-400 text-[11px] mt-2">
                As an Amazon Associate and affiliate partner we may earn from qualifying purchases.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {book.coupons.map((c) => (
              <div key={c.id} className={`bg-white rounded-xl shadow p-4 ${c.usedUp ? "opacity-50" : ""}`}>
                <p className="text-xs text-gray-500 uppercase tracking-wide">{c.businessName}</p>
                <p className="font-bold text-lg">{c.title}</p>
                {c.description && <p className="text-gray-600 text-sm mt-1">{c.description}</p>}
                {c.terms && <p className="text-gray-400 text-xs mt-1">{c.terms}</p>}
                <p className={`text-xs mt-2 font-semibold ${c.usedUp ? "text-red-600" : "text-gray-400"}`}>
                  {c.usedUp ? "Used up" : c.maxRedemptions === 1 ? "One-time use" : "Reusable"}
                </p>
              </div>
            ))}
          </div>
          {book.coupons.length === 0 && (
            <p className="text-center text-gray-500 mt-8">Coupons are on the way. Check back soon!</p>
          )}
        </div>
      </div>
    );
  }

  // Landing / buy view.
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold mb-2">The Gist Deals</h1>
        <p className="text-gray-600 text-sm mb-6">
          Real discounts from local businesses, right on your phone. No apps, no printing, no hassle.
        </p>
        {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{formError}</div>}
        {linkSent && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{linkSent}</div>}
        <label className="block text-sm font-semibold mb-1" htmlFor="coupon-email">Email</label>
        <input
          id="coupon-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border rounded-lg px-3 py-2 mb-4"
        />
        <button
          onClick={buy}
          disabled={buying || !email.includes("@")}
          className="w-full py-3 rounded-xl bg-green-700 text-white font-bold disabled:opacity-50 mb-3"
        >
          {buying ? "Starting checkout…" : `Get the Book — ${cents(priceCents)}, yours for life`}
        </button>
        <button onClick={resendLink} className="w-full py-2 text-sm text-gray-600 underline">
          Already bought one? Email me my link
        </button>
      </div>
    </div>
  );
}

export default function CouponsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading…</p></div>}>
      <CouponsPageInner />
    </Suspense>
  );
}
