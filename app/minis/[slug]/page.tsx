"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { workspaceFetch } from "@/lib/workspace-client";
import SiteHeader from "@/components/SiteHeader";

interface Teaser {
  title: string;
  question: string;
  optionNames: string[];
  optionCount: number;
  ideaCount: number;
  tipCount: number;
}

type GateState = "deals_owner" | "owns_this" | "owns_other" | "new";

function cents(n: number) {
  return `$${(n / 100).toFixed(2).replace(/\.00$/, "")}`;
}

function MiniPageInner({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("cancelled") === "1";
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [teaserError, setTeaserError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [gate, setGate] = useState<GateState | null>(null);
  const [upgradePriceCents, setUpgradePriceCents] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [buying, setBuying] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [linkSent, setLinkSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    workspaceFetch(`/api/minis/${slug}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not open this guide.");
        setTeaser(data.teaser);
      })
      .catch((e) => setTeaserError(e instanceof Error ? e.message : "Could not open this guide."));
  }, [slug]);

  async function check() {
    setChecking(true);
    setFormError(null);
    setLinkSent(null);
    try {
      const res = await workspaceFetch("/api/minis/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setGate(data.state);
      setUpgradePriceCents(data.upgradePriceCents);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setChecking(false);
    }
  }

  async function buy() {
    setBuying(true);
    setFormError(null);
    try {
      const res = await workspaceFetch("/api/minis/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Checkout failed.");
      setBuying(false);
    }
  }

  async function upgrade() {
    setUpgrading(true);
    setFormError(null);
    try {
      const res = await workspaceFetch("/api/minis/upgrade-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Checkout failed.");
      setUpgrading(false);
    }
  }

  async function resendLink() {
    setFormError(null);
    setLinkSent(null);
    try {
      const res = await workspaceFetch("/api/minis/magic-link", {
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

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col">
      <SiteHeader />
      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-10">
          {teaserError ? (
            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm p-6 text-center">
              <h1 className="text-xl font-bold text-stone-900 mb-2">Guide not found</h1>
              <p className="text-gray-600 text-sm">{teaserError}</p>
            </div>
          ) : !teaser ? (
            <p className="text-center text-gray-500">Opening this guide…</p>
          ) : (
            <>
              {cancelled && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-4 text-sm text-amber-900">
                  Checkout was cancelled. Nothing was charged.
                </div>
              )}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-extrabold text-stone-900 tracking-tight">{teaser.title}</h1>
                <p className="text-gray-600 mt-2">{teaser.question}</p>
              </div>

              <section className="bg-white rounded-3xl border border-stone-100 shadow-sm p-6 mb-6">
                <h2 className="font-bold text-lg text-stone-900 mb-3">What&apos;s inside</h2>
                {teaser.optionNames.length > 0 && (
                  <ul className="space-y-1 mb-3">
                    {teaser.optionNames.map((name) => (
                      <li key={name} className="text-sm text-gray-700">• {name}</li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-gray-500">
                  {teaser.optionCount} options · {teaser.ideaCount} ideas
                  {teaser.tipCount > 0 ? ` · ${teaser.tipCount} tips` : ""}
                </p>
              </section>

              <section className="bg-white rounded-3xl border border-stone-100 shadow-sm p-6">
                <label className="block text-sm font-semibold mb-1" htmlFor="mini-email">
                  Email
                </label>
                <input
                  id="mini-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setGate(null);
                  }}
                  placeholder="you@example.com"
                  className="w-full border rounded-xl px-3 py-2 text-sm mb-3"
                />
                {!gate ? (
                  <button
                    type="button"
                    onClick={check}
                    disabled={checking || !email.includes("@")}
                    className="w-full bg-green-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
                  >
                    {checking ? "Checking…" : "Continue"}
                  </button>
                ) : gate === "deals_owner" ? (
                  <div>
                    <p className="text-sm text-gray-700 mb-3">
                      This guide is included with your Deals book. No need to buy it.
                    </p>
                    <button
                      type="button"
                      onClick={resendLink}
                      className="w-full bg-green-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm"
                    >
                      Email me my portal link
                    </button>
                  </div>
                ) : gate === "owns_this" ? (
                  <div>
                    <p className="text-sm text-gray-700 mb-3">
                      You already own this guide. No need to buy it again.
                    </p>
                    <button
                      type="button"
                      onClick={resendLink}
                      className="w-full bg-green-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm"
                    >
                      Email me my portal link
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={buy}
                      disabled={buying}
                      className="w-full bg-green-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
                    >
                      {buying ? "Starting checkout…" : "Get the guide — $5, one time"}
                    </button>
                    {gate === "owns_other" && upgradePriceCents != null && (
                      <div className="mt-4 bg-green-50 border border-green-100 rounded-2xl p-4">
                        <p className="font-bold text-sm text-stone-900">Already have a guide?</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Upgrade to the full Deals book instead, every coupon, every weekly
                          deal, and every future guide, for {cents(upgradePriceCents)} one time.
                        </p>
                        <button
                          type="button"
                          onClick={upgrade}
                          disabled={upgrading}
                          className="mt-3 bg-green-700 text-white font-semibold rounded-xl px-4 py-2 text-sm disabled:opacity-50"
                        >
                          {upgrading ? "Starting checkout…" : `Upgrade — ${cents(upgradePriceCents)}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {linkSent && <p className="text-green-700 text-sm mt-3">{linkSent}</p>}
                {formError && <p className="text-red-600 text-sm mt-3">{formError}</p>}
                <p className="text-gray-400 text-xs mt-4">
                  One-time purchase, yours for life. Guides are included free with the full
                  Deals book.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MiniPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense>
      <MiniPageInner slug={params.slug} />
    </Suspense>
  );
}
