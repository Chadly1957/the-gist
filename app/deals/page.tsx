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
  qrDataUrl: string;
}

interface BookDeal {
  title: string;
  price?: string | null;
  businessName?: string | null;
  dealUrl?: string | null;
  isItemUrl?: boolean;
  isTopPick: boolean;
}

interface BookRetailerDeals {
  displayName: string;
  logoUrl?: string | null;
  deals: BookDeal[];
}

interface GasData {
  live: boolean;
  stations: Array<{ name: string; regular: number | null; updatedAt: string }>;
  updatedAt: string | null;
}

interface BookData {
  email: string;
  dealsLogoUrl?: string | null;
  dealsEmailHeaderUrl?: string | null;
  coupons: BookCoupon[];
  gas?: GasData;
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

// Sleek scrolling ticker for top picks. One marquee, used sparingly.
function TopPicksMarquee({ picks }: { picks: BookDeal[] }) {
  if (!picks.length) return null;
  const items = picks.map((d, i) => {
    const inner = (
      <>
        <span>⭐</span>
        {d.businessName && <span className="text-stone-400">{d.businessName}:</span>}
        <span className="font-medium">{d.title}</span>
        {d.price && <span className="font-bold text-amber-300">{d.price}</span>}
      </>
    );
    return d.dealUrl ? (
      <a key={i} href={d.dealUrl} target="_blank" rel="noreferrer"
         className="mx-6 inline-flex items-center gap-2 whitespace-nowrap text-sm hover:underline">
        {inner}
      </a>
    ) : (
      <span key={i} className="mx-6 inline-flex items-center gap-2 whitespace-nowrap text-sm">
        {inner}
      </span>
    );
  });
  return (
    <div className="overflow-hidden bg-stone-900 text-white rounded-2xl py-2.5 mb-4">
      <style>{`@keyframes gist-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      <div className="flex w-max" style={{ animation: "gist-marquee 30s linear infinite" }}>
        <div className="flex items-center">{items}</div>
        <div className="flex items-center" aria-hidden="true">{items}</div>
      </div>
    </div>
  );
}

function GasBox({ gas }: { gas?: GasData }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">⛽ Current gas prices</p>
      {!gas?.live ? (
        <p className="text-sm text-gray-500">Live local prices coming soon.</p>
      ) : gas.stations.length === 0 ? (
        <p className="text-sm text-gray-500">No stations reporting right now.</p>
      ) : (
        <ul className="space-y-2">
          {gas.stations.slice(0, 5).map((s, i) => (
            <li key={i} className="flex items-baseline justify-between text-sm">
              <span className="text-gray-700 font-medium truncate mr-2">{s.name}</span>
              <span className="font-bold text-gray-900">
                {s.regular != null ? `$${s.regular.toFixed(2)}` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DealsPageInner() {
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

  // Logged-in book view: bento grid.
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

    const hasDeals = book.deals && (book.deals.topPicks.length > 0 || book.deals.retailers.length > 0);
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-100 to-gray-200 p-4 pb-10">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="bg-stone-200 rounded-3xl p-6 mb-4 text-center shadow-sm">
            {book.dealsEmailHeaderUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={book.dealsEmailHeaderUrl} alt="The Gist Deals" className="w-full h-auto mb-4 rounded-xl" />
            ) : book.dealsLogoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={book.dealsLogoUrl} alt="The Gist Deals" className="mx-auto h-16 w-auto mb-3" />
            ) : null}
            <h1 className="text-2xl font-bold text-stone-900">My Gist Deals Book</h1>
            <p className="text-stone-500 text-sm mt-1">{book.email}</p>
          </div>

          {book.deals && <TopPicksMarquee picks={book.deals.topPicks} />}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* This Week's Deals — one wide box per retailer, all deals nested inside */}
            {hasDeals && (
              <div className="sm:col-span-2">
                <div className="flex items-baseline justify-between mb-3 px-1">
                  <h2 className="font-bold text-lg">This Week&apos;s Deals</h2>
                  {book.deals!.weekLabel && (
                    <p className="text-gray-400 text-xs">{book.deals!.weekLabel}</p>
                  )}
                </div>
                <div className="space-y-4">
                  {book.deals!.retailers.map((r) => {
                    const deals = r.deals.filter((d) => !d.isTopPick);
                    if (!deals.length) return null;
                    return (
                      <div key={r.displayName} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-3">
                          {r.logoUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={r.logoUrl} alt={r.displayName} className="h-8 w-auto object-contain" />
                          )}
                          <p className="font-bold">{r.displayName}</p>
                          <span className="text-xs text-gray-400">{deals.length} deals</span>
                        </div>
                        <ul className="space-y-1.5 max-h-[26rem] overflow-y-auto pr-2">
                          {deals.map((d, i) => (
                            <li key={i} className="text-[13px] text-gray-700 leading-snug">
                              {d.businessName && <span className="text-gray-400">{d.businessName}: </span>}
                              {d.title}
                              {d.price && <span className="font-bold"> {d.price}</span>}
                              {d.dealUrl && (
                                <a href={d.dealUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline ml-1">
                                  {d.isItemUrl ? "view item →" : "weekly ad →"}
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <p className="text-gray-400 text-[11px] mt-3 px-1">
                  As an Amazon Associate and affiliate partner we may earn from qualifying purchases.
                </p>
              </div>
            )}

            {/* Local coupons — each tile has its own QR */}
            <div className="sm:col-span-2">
              <h2 className="font-bold text-lg mb-3 px-1">Local Coupons</h2>
              {book.coupons.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                  <p className="text-center text-gray-500 text-sm">Coupons are on the way. Check back soon!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {book.coupons.map((c) => (
                    <div key={c.id} className={`bg-white rounded-3xl border border-gray-100 shadow-sm p-5 ${c.usedUp ? "opacity-50" : ""}`}>
                      <p className="text-[11px] text-gray-400 uppercase tracking-widest">{c.businessName}</p>
                      <p className="font-bold text-lg leading-tight mt-0.5">{c.title}</p>
                      {c.description && <p className="text-gray-600 text-sm mt-1">{c.description}</p>}
                      {c.terms && <p className="text-gray-400 text-xs mt-1">{c.terms}</p>}
                      {!c.usedUp && (
                        <div className="mt-3 flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.qrDataUrl} alt={`QR code for ${c.title}`} className="w-20 h-20 rounded-lg" />
                          <p className="text-xs text-gray-500">Show at {c.businessName} to redeem</p>
                        </div>
                      )}
                      <p className={`text-xs mt-2 font-semibold ${c.usedUp ? "text-red-600" : "text-gray-400"}`}>
                        {c.usedUp ? "Used up" : c.maxRedemptions === 1 ? "One-time use" : "Reusable"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gas prices */}
            <GasBox gas={book.gas} />

            {/* Stack your savings */}
            {(book.referrals?.rakuten || book.referrals?.ibotta) && (
              <div className="bg-green-50 border border-green-100 rounded-3xl shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-700 mb-2">💰 Stack your savings</p>
                {book.referrals.note && <p className="text-xs text-gray-600 mb-2">{book.referrals.note}</p>}
                <p className="text-sm">
                  {book.referrals.rakuten && (
                    <a href={book.referrals.rakuten} target="_blank" rel="noreferrer" className="text-teal-700 underline font-medium">
                      Get cash back with Rakuten
                    </a>
                  )}
                  {book.referrals.rakuten && book.referrals.ibotta && <span className="text-gray-400"> · </span>}
                  {book.referrals.ibotta && (
                    <a href={book.referrals.ibotta} target="_blank" rel="noreferrer" className="text-teal-700 underline font-medium">
                      Get the Ibotta app
                    </a>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Landing / buy view.
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 to-gray-200 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
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

export default function DealsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading…</p></div>}>
      <DealsPageInner />
    </Suspense>
  );
}
