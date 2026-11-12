"use client";
import { workspaceFetch } from "@/lib/workspace-client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";
import DealsOto from "@/components/DealsOto";
import SponsorsMarquee from "@/components/SponsorsMarquee";
import OriginalArticles from "@/components/OriginalArticles";
import ProductsSection, { type ShopProduct } from "@/components/ProductsSection";
import PhoneIssuePreview from "@/components/PhoneIssuePreview";
import SiteHeader from "@/components/SiteHeader";

function CityLandingPage() {
  const { workspace } = useWorkspace();
  // Key branding off the slug (human-chosen, e.g. "effingham"), falling back
  // to the id. New workspaces get generated cuid ids, so id alone misses.
  const brand = workspace.slug || workspace.id;
  const [email, setEmail] = useState("");
  // Keep the just-subscribed email around after the form clears so the
  // Deals upsell can carry it through to /deals (no re-typing).
  const [subscribedEmail, setSubscribedEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [subCount, setSubCount] = useState<number | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);

  // Hero photo: the workspace's own image, falling back to the per-city
  // default. Used both for the hero backdrop and as the phone preview's
  // fallback when no latest issue loads.
  const heroSrc = workspace.heroImageUrl ?? (brand === "effingham" ? "/hero-effingham.png" : "/hero-decatur.jpg");
  const heroAlt = workspace.heroImageUrl ? `${workspace.name} hero image` : brand === "effingham" ? "Effingham County Courthouse" : "Historic Decatur pavilion";

  useEffect(() => {
    workspaceFetch("/api/subscriber-count")
      .then((r) => r.json())
      .then((d) => setSubCount(d.rounded ?? null))
      .catch(() => null);
  }, []);

  // Shop: drives the nav link, footer link, and the homepage shop section.
  // All three render only when this workspace has at least one active product.
  useEffect(() => {
    workspaceFetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d.products) ? d.products : []))
      .catch(() => setProducts([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      // Acquisition capture, same as /join: UTM params from the landing
      // URL (ad traffic) plus the browser referrer. Stored on the
      // subscriber at signup; nothing here changes the signup itself.
      const params = new URLSearchParams(window.location.search);
      const res = await workspaceFetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          utmSource: params.get("utm_source"),
          utmMedium: params.get("utm_medium"),
          utmCampaign: params.get("utm_campaign"),
          referrer: document.referrer || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "You're in! Welcome to " + workspace.name + ".");
        setSubscribedEmail(email);
        setEmail("");
        // Meta Pixel signup event, same as /join, so the pixel counts
        // homepage signups too. Guarded so a blocked pixel can never
        // break the signup itself.
        const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
        if (typeof fbq === "function") fbq("track", "Lead");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#f2f6f1] flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* ── HERO: full-width photo with the signup card overlaid left ── */}
        <section className="max-w-6xl mx-auto px-6 pt-6 sm:pt-10">
          <div className="relative rounded-[2rem] overflow-hidden">
            {/* Plain img (not next/image): the hero source can be a remote
                branding URL, and this keeps the photo rendering zero-risk. */}
            <img
              src={heroSrc}
              alt={heroAlt}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="relative px-4 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-16 min-h-[560px] sm:min-h-[620px] flex items-center">
              <div className="w-full max-w-md rounded-3xl bg-white/95 p-6 sm:p-8 shadow-xl shadow-gray-900/10">
                {subCount !== null && subCount >= 10 && (
                  <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-5 border border-green-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                    Join {subCount.toLocaleString()} {workspace.area} neighbors who get the free newsletter!
                  </div>
                )}

                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-4">
                  If it&apos;s happening<br />
                  in {workspace.area} IL,<br />
                  <span className="text-green-700">you&apos;ll hear it here first.</span>
                </h1>

                <p className="text-base text-gray-500 leading-relaxed mb-7">
                  Start your morning with {workspace.name}, the one email that tells you what actually matters in {workspace.area} today.
                </p>

                {status === "success" ? (
                  <>
                    <div className="flex items-start gap-4 bg-green-50 border border-green-100 rounded-2xl p-6">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 mb-0.5">You&apos;re subscribed!</p>
                        <p className="text-sm text-gray-500">{message}</p>
                      </div>
                    </div>
                    <DealsOto area={workspace.area} email={subscribedEmail} src="thankyou" />
                  </>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3 w-full">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        placeholder="Your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="flex-1 px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-400"
                      />
                      <button
                        type="submit"
                        disabled={status === "loading"}
                        className="bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-3.5 rounded-xl text-sm transition-colors disabled:opacity-60 whitespace-nowrap w-full sm:w-auto"
                      >
                        {status === "loading" ? "…" : "Subscribe free"}
                      </button>
                    </div>
                    {status === "error" && (
                      <p className="text-red-500 text-sm">{message}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      Free forever. No spam. Unsubscribe anytime.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── INTRO: what this is, and where to go ── */}
        <section className="max-w-6xl mx-auto px-6 pt-14 sm:pt-20 pb-2 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            All of {workspace.area}, in one place.
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed mb-8">
            Local news, events, deals, and the businesses that make {workspace.area} home, pulled together every morning by people who live here.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href="/articles" className="inline-flex items-center rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 transition-colors">
              Local News
            </Link>
            <Link href="/events" className="inline-flex items-center rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 transition-colors">
              Events
            </Link>
            <Link href="/deals" className="inline-flex items-center rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 transition-colors">
              Deals
            </Link>
            <Link href="/partners" className="inline-flex items-center rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 transition-colors">
              Business Directory
            </Link>
            <Link href="/board" className="inline-flex items-center rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 transition-colors">
              Community Board
            </Link>
          </div>
        </section>

        {/* ── WHAT YOU GET + phone preview of the latest issue ── */}
        <section className="py-14 sm:py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
                What&apos;s in each issue?
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Everything you need to know about {workspace.area}, delivered in under two minutes.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {[
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  ),
                  title: "Top Local Stories",
                  desc: `Curated articles from trusted ${workspace.area} sources, delivered fresh each morning.`,
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: "2-Minute Read",
                  desc: "Concise summaries so you stay informed without spending your whole morning reading.",
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                  title: "Straight to Inbox",
                  desc: `No algorithms. No doomscrolling. Just your daily ${workspace.area} digest, right in your email.`,
                },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-5">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-base">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Phone preview, moved out of the hero: a peek inside the latest issue. */}
            <div className="mt-12 rounded-[2rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="grid lg:grid-cols-2 gap-10 items-center px-6 py-10 sm:px-10 sm:py-14">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-3">Inside the email</p>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-4">
                    A peek at this morning&apos;s issue.
                  </h3>
                  <p className="text-gray-500 leading-relaxed mb-6">
                    Every issue is short, local, and skimmable, the stories, events, and deals that matter in {workspace.area}, in about two minutes. Here is the latest one, live on your screen.
                  </p>
                  <Link href="/issues" className="text-sm font-semibold text-green-700 hover:underline">
                    Browse all issues →
                  </Link>
                </div>
                <PhoneIssuePreview heroSrc={heroSrc} heroAlt={heroAlt} />
              </div>
            </div>
          </div>
        </section>

        <OriginalArticles />

        <SponsorsMarquee
          band
          eyebrow="Featured Partner"
          heading="The local businesses behind The Gist"
          copy={`Meet the ${workspace.area} businesses in our free directory, from neighborhood favorites to new finds.`}
        />

        {/* ── EXPLORE: events, deals, directory ── */}
        <section className="pb-14 sm:pb-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
                More to explore in {workspace.area}.
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Events, deals, and local businesses, all in one place.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              <Link href="/events" className="group block bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:border-green-200 hover:bg-green-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-base group-hover:text-green-800 transition-colors">What&apos;s on in {workspace.area}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">Concerts, markets, fundraisers, and everything worth leaving the house for.</p>
                <p className="text-sm text-green-700 font-medium">Browse events →</p>
              </Link>
              <Link href="/deals" className="group block bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:border-green-200 hover:bg-green-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-base group-hover:text-green-800 transition-colors">Save around {workspace.area}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">Local deals and discounts from {workspace.area} businesses, all in one book.</p>
                <p className="text-sm text-green-700 font-medium">See the deals →</p>
              </Link>
              <Link href="/partners" className="group block bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:border-green-200 hover:bg-green-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-base group-hover:text-green-800 transition-colors">Find a local business</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">The free directory of {workspace.area} businesses, from neighborhood favorites to new finds.</p>
                <p className="text-sm text-green-700 font-medium">Browse the directory →</p>
              </Link>
            </div>
          </div>
        </section>

        <ProductsSection products={products} area={workspace.area} />

        {/* ── SPONSORSHIP CTA ── */}
        <section className="bg-green-900 py-14 sm:py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: copy */}
              <div>
                <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-4">For Local Businesses</p>
                <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
                  Reach {workspace.area}<br />readers every day.
                </h2>
                <p className="text-green-200 text-base leading-relaxed mb-8 max-w-md">
                  Connect your business with engaged, local subscribers who actually read their newsletter. Three tiers designed for every budget, starting free.
                </p>
                <Link
                  href="/sponsor"
                  className="inline-flex items-center gap-2 bg-white text-green-900 font-bold px-6 py-3.5 rounded-xl text-sm hover:bg-green-50 transition-colors"
                >
                  See Sponsorship Options
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>

              {/* Right: tier cards */}
              <div className="space-y-3">
                {[
                  {
                    name: "Business Directory",
                    price: "Free",
                    desc: "Your listing in the public directory, event submissions, and rotating Spotlight eligibility.",
                    accent: "bg-green-800 border-green-700",
                  },
                  {
                    name: "7-Issue Featured Campaign",
                    price: "$150 · $99",
                    desc: "One featured promotion in 7 consecutive daily issues. $150 in Decatur, $99 in Effingham, $229 for both.",
                    accent: "bg-green-800 border-green-700",
                  },
                  {
                    name: "Presenting Partnership",
                    price: "$333/mo",
                    desc: "Logo in every issue, 10+ features a month, and an exclusive category. Limited to 4 per city.",
                    accent: "bg-green-800 border-green-600",
                  },
                ].map((tier) => (
                  <div key={tier.name} className={`flex items-center gap-4 ${tier.accent} border rounded-xl px-5 py-4`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{tier.name}</p>
                      <p className="text-green-300 text-xs mt-0.5 leading-relaxed">{tier.desc}</p>
                    </div>
                    <span className="text-green-300 font-bold text-sm shrink-0">{tier.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── BOTTOM SIGNUP ── */}
        <section className="py-14 sm:py-20">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
              Join {workspace.area}&apos;s daily briefing.
            </h2>
            <p className="text-gray-500 mb-8">Free forever. One email a day. No fluff.</p>
            {status === "success" ? (
              <>
                <div className="bg-green-50 border border-green-100 rounded-2xl p-6">
                  <p className="font-bold text-green-800 mb-1">You&apos;re subscribed!</p>
                  <p className="text-sm text-green-600">{message}</p>
                </div>
                <div className="flex justify-center text-left mt-2">
                  <div className="w-full max-w-md">
                    <DealsOto area={workspace.area} email={subscribedEmail} src="thankyou" />
                  </div>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-3.5 rounded-xl text-sm transition-colors disabled:opacity-60 whitespace-nowrap w-full sm:w-auto"
                >
                  {status === "loading" ? "…" : "Subscribe free"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer: centered logo, tagline, links, copyright. No social
          icons: the repo has no real Gist social URLs to link to. */}
      <footer className="border-t border-green-900/10 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center text-center gap-5">
          <Logo className="h-10 w-auto" />
          <p className="text-sm text-gray-500">The daily newsletter for {workspace.area}.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
            <Link href="/games" className="hover:text-gray-600 transition-colors">Games</Link>
            {products.length > 0 && (
              <Link href="/products" className="hover:text-gray-600 transition-colors">Shop</Link>
            )}
            <Link href="/sponsor" className="hover:text-gray-600 transition-colors">Advertise</Link>
            <Link href="/policy" className="hover:text-gray-600 transition-colors">Policies</Link>
            <Link href="/unsubscribe" className="hover:text-gray-600 transition-colors">Unsubscribe</Link>
          </div>
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} {workspace.name}</p>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return <CityLandingPage />;
}
