"use client";

import { Suspense, createContext, useEffect, useState } from "react";
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
  refreshInterval: string | null;
  redemptionsByMe: number;
  usedUp: boolean;
  qrDataUrl: string;
}

function couponCadenceLabel(c: BookCoupon): { text: string; used: boolean } {
  if (c.refreshInterval === "daily" || c.refreshInterval === "weekly" || c.refreshInterval === "monthly") {
    const period = c.refreshInterval === "daily" ? "daily" : c.refreshInterval === "weekly" ? "weekly" : "monthly";
    const back = c.refreshInterval === "daily" ? "tomorrow" : c.refreshInterval === "weekly" ? "next week" : "next month";
    return c.usedUp ? { text: `Used up — refreshes ${back}`, used: true } : { text: `Refreshes ${period}`, used: false };
  }
  if (c.maxRedemptions != null) {
    return c.usedUp ? { text: "Used up", used: true } : { text: c.maxRedemptions === 1 ? "One-time use" : "Reusable", used: false };
  }
  return { text: "Reusable", used: false };
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

function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface OutboundLink {
  url: string;
  domain: string;
  store: string;
  kind: string;
  checked: string | null;
}

// One calm, honest button for every outbound link. Tapping opens a preview
// sheet first so the buyer always knows exactly where a tap goes.
function DealLinkButton({
  url, store, kind, checked, children, className,
}: {
  url: string; store: string; kind: string; checked: string | null;
  children: React.ReactNode; className?: string;
}) {
  return (
    <OutboundLinkContext.Consumer>
      {(openPreview) => (
        <button
          type="button"
          onClick={() => {
            const domain = domainOf(url);
            if (!domain) return;
            openPreview({ url, domain, store, kind, checked });
          }}
          className={className}
        >
          {children}
        </button>
      )}
    </OutboundLinkContext.Consumer>
  );
}

const OutboundLinkContext = createContext<(l: OutboundLink) => void>(() => {});

function LinkPreviewSheet({ link, onClose }: { link: OutboundLink | null; onClose: () => void }) {
  if (!link) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">You&apos;re heading to</p>
        <p className="text-xl font-bold text-stone-900 break-all">{link.domain}</p>
        <p className="text-sm text-gray-600 mt-2">
          {link.store}&apos;s {link.kind === "item" ? "product page" : link.kind === "referral" ? "site" : "official weekly ad"}.
          {link.checked ? ` We checked this link ${link.checked}.` : " We checked this link this week."}
        </p>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="block text-center w-full mt-5 py-3 rounded-xl bg-green-700 text-white font-bold"
        >
          Open {link.domain}
        </a>
        <button onClick={onClose} className="block w-full mt-2 py-2 text-sm text-gray-500">
          Stay here
        </button>
      </div>
    </div>
  );
}

// This week's best: calm snap-scroll cards instead of an auto-scrolling ticker.
function PicksRow({
  picks, retailers, checked,
}: {
  picks: BookDeal[]; retailers: BookRetailerDeals[]; checked: string | null;
}) {
  if (!picks.length) return null;
  const logoFor = (d: BookDeal) => {
    const r = retailers.find((x) =>
      d.businessName ? x.displayName.toLowerCase() === d.businessName.toLowerCase() : false
    );
    return r?.logoUrl || null;
  };
  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-1 px-1">
        <h2 className="font-bold text-lg text-stone-900">This week&apos;s best</h2>
      </div>
      <p className="text-sm text-gray-500 mb-3 px-1">The standouts, hand-picked Monday morning.</p>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4">
        {picks.map((d, i) => {
          const logo = logoFor(d);
          const domain = domainOf(d.dealUrl);
          return (
            <div key={i} className="snap-start shrink-0 w-64 bg-white rounded-3xl border border-gray-100 shadow-sm p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3 min-h-[2rem]">
                {logo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logo} alt={d.businessName || ""} className="h-7 w-auto object-contain" />
                ) : d.businessName ? (
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{d.businessName}</p>
                ) : null}
              </div>
              <p className="font-bold text-stone-900 leading-snug flex-1">{d.title}</p>
              {d.price && <p className="text-2xl font-extrabold text-green-700 mt-2">{d.price}</p>}
              {d.dealUrl && domain ? (
                <DealLinkButton
                  url={d.dealUrl}
                  store={d.businessName || "This retailer"}
                  kind={d.isItemUrl ? "item" : "ad"}
                  checked={checked}
                  className="mt-4 w-full py-2.5 rounded-xl border border-green-700 text-green-700 text-sm font-bold"
                >
                  See it at {domain}
                </DealLinkButton>
              ) : (
                <p className="mt-4 text-xs text-gray-400">In-store deal, no link needed.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
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

function MiniQR() {
  // Deterministic decorative QR-like pattern for the preview mockup.
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const cells = Array.from({ length: 144 }, () => rand() > 0.52);
  return (
    <div className="grid grid-cols-12 gap-px w-14 h-14 bg-white p-1 rounded-md shrink-0">
      {cells.map((on, i) => (
        <div key={i} className={on ? "bg-stone-900" : "bg-transparent"} />
      ))}
    </div>
  );
}

function MiniBookContent() {
  return (
    <div className="p-3 space-y-2">
      <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
        <p className="text-[11px] font-bold text-stone-900">My Gist Deals Book</p>
      </div>
      <div className="bg-green-50 border border-green-100 rounded-xl px-2 py-1.5">
        <p className="text-[8px] text-green-900 font-semibold">✓ 592 deals hand-checked</p>
      </div>
      <p className="text-[9px] font-bold text-stone-900 px-0.5">This week&apos;s best</p>
      <div className="bg-white rounded-2xl p-2.5 shadow-sm">
        <p className="text-[9px] font-bold text-stone-900">Puzzles, 40% off</p>
        <p className="text-[13px] font-extrabold text-green-700">40% off</p>
        <p className="text-[8px] text-green-700 font-semibold mt-1">See it at hobbylobby.com</p>
      </div>
      <div className="bg-white rounded-2xl p-2.5 shadow-sm">
        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Joe&apos;s Pizza</p>
        <p className="text-[9px] font-bold text-stone-900">2-for-1 large pizzas</p>
        <div className="flex items-center gap-2 mt-1.5">
          <MiniQR />
          <p className="text-[8px] text-gray-500">Show at checkout</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-2.5 shadow-sm">
        <p className="text-[9px] font-bold text-stone-900">Dollar General</p>
        <p className="text-[8px] text-gray-500">281 deals · ✓ Checked Oct 7</p>
      </div>
    </div>
  );
}

function PhonePreview() {
  return (
    <div className="w-[270px] mx-auto">
      <div className="rounded-[2.75rem] bg-stone-900 p-2.5 shadow-2xl">
        <div className="rounded-[2rem] bg-[#faf8f4] overflow-hidden relative">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-stone-900 rounded-full z-10" />
          <style>{`@keyframes gist-preview-scroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }`}</style>
          <div className="h-[430px] overflow-hidden">
            <div style={{ animation: "gist-preview-scroll 22s linear infinite" }}>
              <MiniBookContent />
              <div aria-hidden="true">
                <MiniBookContent />
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-3">A peek inside the book</p>
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
  const [preview, setPreview] = useState<OutboundLink | null>(null);

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

  // Logged-in book view: Local Member Wallet.
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

    const retailers = book.deals?.retailers || [];
    const totalDeals = retailers.reduce((n, r) => n + r.deals.length, 0);
    const weekLabel = book.deals?.weekLabel || null;
    const hasDeals = totalDeals > 0;

    return (
      <OutboundLinkContext.Provider value={setPreview}>
        <div className="min-h-screen bg-[#faf8f4] p-4 pb-10">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-3xl p-6 mb-4 text-center shadow-sm border border-stone-100">
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

            {/* Trust bar */}
            {hasDeals && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-2xl px-4 py-2.5 mb-6">
                <span className="text-green-700 font-bold">✓</span>
                <p className="text-sm text-green-900">
                  <strong>{totalDeals} deals</strong> hand-checked{weekLabel ? ` for ${weekLabel}` : " this week"}.
                </p>
              </div>
            )}

            {/* This week's best */}
            {book.deals && (
              <PicksRow picks={book.deals.topPicks} retailers={retailers} checked={weekLabel} />
            )}

            {/* Local coupons */}
            <section className="mb-6">
              <h2 className="font-bold text-lg text-stone-900 mb-1 px-1">From your neighbors</h2>
              <p className="text-sm text-gray-500 mb-3 px-1">Coupons from local businesses. Show the QR code at checkout.</p>
              {book.coupons.length === 0 ? (
                <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
                  <p className="text-center text-gray-500 text-sm">Local coupons are on the way. Check back soon!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {book.coupons.map((c) => (
                    <div key={c.id} className={`bg-white rounded-3xl border border-stone-100 shadow-sm p-5 ${c.usedUp ? "opacity-50" : ""}`}>
                      <p className="text-[11px] text-gray-400 uppercase tracking-widest">{c.businessName}</p>
                      <p className="font-bold text-lg leading-tight mt-0.5 text-stone-900">{c.title}</p>
                      {c.description && <p className="text-gray-600 text-sm mt-1">{c.description}</p>}
                      {c.terms && <p className="text-gray-400 text-xs mt-1">{c.terms}</p>}
                      {!c.usedUp && (
                        <div className="mt-3 flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.qrDataUrl} alt={`QR code for ${c.title}`} className="w-20 h-20 rounded-lg" />
                          <p className="text-xs text-gray-500">Show at {c.businessName} to redeem</p>
                        </div>
                      )}
                      {(() => {
                        const label = couponCadenceLabel(c);
                        return (
                          <p className={`text-xs mt-2 font-semibold ${label.used ? "text-red-600" : "text-gray-400"}`}>
                            {label.text}
                          </p>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* The full book */}
            {hasDeals && (
              <section className="mb-6">
                <h2 className="font-bold text-lg text-stone-900 mb-1 px-1">The full book</h2>
                <p className="text-sm text-gray-500 mb-3 px-1">Every deal we found this week, organized by store.</p>
                <div className="space-y-4">
                  {retailers.map((r) => {
                    if (!r.deals.length) return null;
                    return (
                      <div key={r.displayName} className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-1">
                          {r.logoUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={r.logoUrl} alt={r.displayName} className="h-8 w-auto object-contain" />
                          )}
                          <p className="font-bold text-stone-900">{r.displayName}</p>
                          <span className="text-xs text-gray-400">{r.deals.length} deals</span>
                        </div>
                        {weekLabel && (
                          <p className="text-[11px] text-gray-400 mb-3 flex items-center gap-1">
                            <span className="text-green-600 font-bold">✓</span> Checked {weekLabel}
                          </p>
                        )}
                        <ul className="space-y-3 max-h-[26rem] overflow-y-auto pr-2">
                          {r.deals.map((d, i) => {
                            const domain = domainOf(d.dealUrl);
                            return (
                              <li key={i} className="text-[13px] text-gray-700 leading-snug border-b border-stone-50 pb-3 last:border-0 last:pb-0">
                                {d.businessName && <span className="text-gray-400">{d.businessName}: </span>}
                                <span className="font-medium text-stone-900">{d.title}</span>
                                {d.price && <span className="font-bold text-stone-900"> {d.price}</span>}
                                {d.dealUrl && domain && (
                                  <span className="block mt-1">
                                    <DealLinkButton
                                      url={d.dealUrl}
                                      store={r.displayName}
                                      kind={d.isItemUrl ? "item" : "ad"}
                                      checked={weekLabel}
                                      className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-full px-3 py-1"
                                    >
                                      {d.isItemUrl ? "View item" : "Weekly ad"} · {domain}
                                    </DealLinkButton>
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <p className="text-gray-400 text-[11px] mt-3 px-1">
                  When you shop through some links we may earn a commission. It never changes the price you pay.
                </p>
              </section>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Gas prices */}
              <GasBox gas={book.gas} />

              {/* Stack your savings */}
              {(book.referrals?.rakuten || book.referrals?.ibotta) && (
                <div className="bg-green-50 border border-green-100 rounded-3xl shadow-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-green-700 mb-2">Stack your savings</p>
                  {book.referrals.note && <p className="text-xs text-gray-600 mb-2">{book.referrals.note}</p>}
                  <div className="flex flex-col gap-2">
                    {book.referrals.rakuten && (
                      <DealLinkButton
                        url={book.referrals.rakuten}
                        store="Rakuten"
                        kind="referral"
                        checked={null}
                        className="text-sm text-green-800 font-semibold bg-white border border-green-200 rounded-xl px-3 py-2 text-left"
                      >
                        Get cash back with Rakuten · rakuten.com
                      </DealLinkButton>
                    )}
                    {book.referrals.ibotta && (
                      <DealLinkButton
                        url={book.referrals.ibotta}
                        store="Ibotta"
                        kind="referral"
                        checked={null}
                        className="text-sm text-green-800 font-semibold bg-white border border-green-200 rounded-xl px-3 py-2 text-left"
                      >
                        Get the Ibotta app · ibotta.com
                      </DealLinkButton>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <LinkPreviewSheet link={preview} onClose={() => setPreview(null)} />
      </OutboundLinkContext.Provider>
    );
  }

  // Landing / buy view.
  return (
    <div className="min-h-screen bg-[#faf8f4]">
      {/* Hero */}
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3">From The Gist</p>
        <h1 className="text-4xl font-extrabold text-stone-900 tracking-tight">The Gist Deals</h1>
        <p className="text-lg text-gray-600 mt-3 max-w-md mx-auto">
          Every deal worth knowing about, in one little book on your phone.
        </p>
        <div className="mt-5">
          <a
            href="#get-the-book"
            className="inline-block bg-green-700 text-white text-sm font-bold px-5 py-2.5 rounded-full"
          >
            $15 once — yours for life
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-2">No subscription. No renewals.</p>
      </div>

      {/* Preview */}
      <div className="pb-10">
        <PhonePreview />
      </div>

      {/* What's inside */}
      <section className="max-w-2xl mx-auto px-4 pb-10">
        <h2 className="font-bold text-xl text-stone-900 text-center mb-5">What&apos;s inside</h2>
        <div className="space-y-3">
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5 flex gap-4">
            <span className="text-2xl shrink-0">🏷️</span>
            <div>
              <p className="font-bold text-stone-900">Weekly store deals</p>
              <p className="text-sm text-gray-600 mt-1">
                Every weekly ad from stores like Target, Aldi, Kroger, Dollar General, and Hobby Lobby,
                pulled into one place. We hand-check the standouts every Monday.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5 flex gap-4">
            <span className="text-2xl shrink-0">🎟️</span>
            <div>
              <p className="font-bold text-stone-900">Local coupons</p>
              <p className="text-sm text-gray-600 mt-1">
                Real coupons from local businesses, each with its own QR code.
                Just show your phone at checkout. New ones added all the time.
              </p>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5 flex gap-4">
            <span className="text-2xl shrink-0">⭐</span>
            <div>
              <p className="font-bold text-stone-900">The week&apos;s 10 best</p>
              <p className="text-sm text-gray-600 mt-1">
                Don&apos;t want to dig through hundreds of deals? Start with the ten we&apos;d actually buy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-2xl mx-auto px-4 pb-10">
        <h2 className="font-bold text-xl text-stone-900 text-center mb-5">How it works</h2>
        <ol className="space-y-3">
          {[
            { n: "1", t: "Buy the book", d: "$15, one time. It never expires and never renews." },
            { n: "2", t: "Get your personal link", d: "We email it to you. It works on any phone, no app to install." },
            { n: "3", t: "Save money", d: "Tap a deal to shop it online, or show a QR code at a local business." },
          ].map((s) => (
            <li key={s.n} className="bg-white rounded-3xl border border-stone-100 shadow-sm p-5 flex gap-4 items-start">
              <span className="shrink-0 w-8 h-8 rounded-full bg-green-700 text-white font-bold flex items-center justify-center text-sm">
                {s.n}
              </span>
              <div>
                <p className="font-bold text-stone-900">{s.t}</p>
                <p className="text-sm text-gray-600 mt-0.5">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Buy box */}
      <section id="get-the-book" className="max-w-md mx-auto px-4 pb-8 scroll-mt-6">
        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6">
          <h2 className="text-xl font-bold text-stone-900 mb-1">Get the Book</h2>
          <p className="text-sm text-gray-500 mb-5">$15 once, yours for life.</p>
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
      </section>

      {/* Honest fine print */}
      <div className="max-w-2xl mx-auto px-6 pb-12">
        <p className="text-xs text-gray-400 leading-relaxed text-center">
          Inside you&apos;ll find deals from stores&apos; public weekly ads, plus coupons from participating
          local businesses. New deals land every Monday. When you shop through some links we may earn a
          commission. It never changes the price you pay.
        </p>
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
