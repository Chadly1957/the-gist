"use client";

import { useState } from "react";
import Link from "@/components/workspace/WorkspaceLink";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { workspaceFetch } from "@/lib/workspace-client";
import { PARTNER_CATEGORIES } from "@/lib/partner-categories";

// Sponsorship landing page (October 2026 freemium restructure). Leads with
// the free Business Directory listing: the signup form sits in the hero.
// Paid offers are exactly two: the 7-Issue Featured Campaign and the
// Presenting Partnership. Prices and market lines mirror the offer config
// in lib/sponsor-weeks.ts (campaign) and the partnership brochure.
type Market = "decatur" | "effingham" | "both";
type Interest = "free" | "campaign" | "partner";

const CAMPAIGN_PRICE: Record<Market, number> = { decatur: 150, effingham: 99, both: 229 };
const PARTNER_PRICE: Record<Market, number> = { decatur: 333, effingham: 333, both: 583 };
const MARKET_LINE: Record<Market, string> = {
  decatur: "Decatur: 681 subscriptions · approximately 15-mile editorial coverage radius",
  effingham: "Effingham: 388 subscriptions · approximately 30-mile editorial coverage radius",
  both: "Both newsletters: 1,069 subscriptions combined · some subscribers may overlap",
};
const MARKET_DOMAIN: Record<"decatur" | "effingham", string> = {
  decatur: "https://www.thegistdecatur.com",
  effingham: "https://www.thegisteffingham.com",
};

const PINE = "#0c5e59";
const PINE_DARK = "#0a3232";
const PINE_DEEP = "#072b29";
const MINT = "#c8f6e7";
const CREAM = "#faf9f5";
const CREAM_DARK = "#f1f0e9";
const INK = "#182c2d";
const MUTED = "#61706c";
const BORDER = "#dce6df";
const MINT_BG = "#eaf4ec";

function Check({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}
function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] uppercase mb-4 ${light ? "text-emerald-300" : ""}`} style={light ? undefined : { color: PINE }}>
      <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#18c997" }} />
      {children}
    </p>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is the difference between the free business directory and the Community Board?",
    a: "The Business Directory is free for eligible businesses, and every listing also appears on our public Partners page for its city. The separate Community Board is a $5/week classified posting product for readers or businesses. A classified does not include guaranteed newsletter advertising.",
  },
  {
    q: "Is the business listing really free?",
    a: "Yes. Eligible local businesses can have a free directory listing and submit qualifying events. They can also be considered for the five-business rotating Spotlight. A free account does not guarantee newsletter impressions or require a paid upgrade.",
  },
  {
    q: "Do seven-issue campaigns include weekends?",
    a: "Yes. The Gist publishes every day at 10 AM, including Saturday and Sunday. A seven-issue campaign appears in seven consecutive daily editions, subject to confirmed start dates and approved creative.",
  },
  {
    q: "What makes a Presenting Partner different?",
    a: "A Featured Campaign is short-term promotion with one placement in each of seven issues. A Presenting Partner gets its logo in every daily issue, guaranteed recurring feature placements, limited partner inventory, and exclusivity within its sponsor category in the Presenting Partner program.",
  },
  {
    q: "How does category exclusivity work?",
    a: "We limit Presenting Partners to four per market. Within a selected category, The Gist will not accept another direct competitor as a Presenting Partner in that publication during your agreement. Other advertising, free directory entries and independent news remain unaffected.",
  },
  {
    q: "What if my business serves both cities?",
    a: "You can select both publications. Each has a distinct editorial coverage radius and audience; some people may subscribe to both. Combined-package pricing is shown in the market selector above.",
  },
  {
    q: "Do you guarantee clicks, leads or sales?",
    a: "No. We guarantee agreed placements, not customer actions. We'll help craft a clear call to action and report available response data so you can judge whether continued sponsorship makes business sense.",
  },
  {
    q: "Is a paid business profile the same as independent news coverage?",
    a: "No. Paid profiles are written or produced by The Gist but clearly marked as sponsored content. News coverage remains editorially independent, and a sponsorship never guarantees favorable news reporting.",
  },
  {
    q: "Can I promote an event without buying an ad?",
    a: "Yes. Eligible community events can be submitted for free. When you need guaranteed newsletter placement for a ticketed event, launch or deadline, a seven-issue Featured Campaign is the relevant upgrade.",
  },
];

export default function SponsorshipLanding() {
  const { workspace } = useWorkspace();
  const [market, setMarket] = useState<Market>("decatur");
  const [interest, setInterest] = useState<Interest>("free");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Hero free-listing form (creates the listing in this site's city).
  const [hero, setHero] = useState({ businessName: "", contactName: "", email: "", website: "", category: "", description: "" });
  const [heroBusy, setHeroBusy] = useState(false);
  const [heroError, setHeroError] = useState("");
  const [heroDone, setHeroDone] = useState(false);

  // Bottom lead form.
  const [lead, setLead] = useState({ businessName: "", contactName: "", email: "", goal: "" });
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [leadDone, setLeadDone] = useState<Interest | null>(null);

  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function campaignHref(): string {
    if (market === "both") return "/sponsor/apply?market=both";
    if (market === workspace.slug) return "/sponsor/apply";
    return `${MARKET_DOMAIN[market]}/sponsor/apply`;
  }

  async function submitHero(e: React.FormEvent) {
    e.preventDefault();
    setHeroBusy(true);
    setHeroError("");
    try {
      const res = await workspaceFetch("/api/sponsor/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...hero, subscribeNewsletter: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create your listing.");
      setHeroDone(true);
    } catch (err) {
      setHeroError(err instanceof Error ? err.message : "Could not create your listing.");
    } finally {
      setHeroBusy(false);
    }
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setLeadBusy(true);
    setLeadError("");
    try {
      const res = await workspaceFetch("/api/sponsor/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interest, market, ...lead }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      setLeadDone(interest);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLeadBusy(false);
    }
  }

  const inputCls = "w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white";
  const inputStyle = { borderColor: BORDER, color: INK } as const;

  return (
    <div style={{ background: CREAM, color: INK }} className="font-sans">
      {/* Announcement bar */}
      <div className="text-center px-4 py-2.5 text-[13px]" style={{ background: PINE_DEEP, color: "#e8f5ef" }}>
        Local businesses: your free business profile is waiting.{" "}
        <button onClick={() => scrollToId("free-signup")} className="font-bold underline underline-offset-2" style={{ color: MINT }}>
          Get listed for free
        </button>
      </div>

      {/* HERO */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <Eyebrow>For businesses that call this place home</Eyebrow>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.02] mb-5">
              Get <span style={{ color: PINE }} className="underline decoration-[#bbf0d6] decoration-[6px] underline-offset-4">FREE</span> marketing for your business.
            </h1>
            <p className="text-base sm:text-lg leading-relaxed mb-7" style={{ color: MUTED }}>
              Get discovered by local readers of The Gist. Create your free business listing in our Business Directory,
              share upcoming events, and become eligible for our rotating Business Spotlight.{" "}
              <strong style={{ color: INK }}>Want guaranteed visibility?</strong> We&apos;ve got simple ways to do that, too.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              <button onClick={() => scrollToId("free-signup")} className="px-5 py-3 rounded-xl text-white font-semibold text-sm inline-flex items-center gap-2 hover:opacity-90" style={{ background: PINE_DARK }}>
                Get your free listing <Arrow />
              </button>
              <button onClick={() => scrollToId("sponsorships")} className="px-5 py-3 rounded-xl font-semibold text-sm border hover:bg-white" style={{ borderColor: BORDER, color: INK }}>
                Explore paid opportunities
              </button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]" style={{ color: MUTED }}>
              <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> No credit card to join</span>
              <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Decatur + Effingham</span>
              <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Daily at 10 AM</span>
            </div>
          </div>

          {/* Free signup form, top of the fold */}
          <div id="free-signup" className="rounded-[22px] border bg-white p-5 sm:p-6 shadow-[0_22px_65px_rgba(7,48,45,0.10)] scroll-mt-24" style={{ borderColor: BORDER }}>
            {heroDone ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: MINT_BG, color: PINE }}>
                  <Check className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-extrabold mb-2">You&apos;re in the directory!</h2>
                <p className="text-sm leading-relaxed mb-5" style={{ color: MUTED }}>
                  Your free listing is live in the {workspace.name} Business Directory and in the rotating Spotlight pool.
                  Add your logo and polish your listing anytime in your sponsor portal.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/partners" className="px-4 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: PINE_DARK }}>
                    See the directory
                  </Link>
                  <Link href="/sponsor/community" className="px-4 py-2.5 rounded-xl font-semibold text-sm border" style={{ borderColor: BORDER }}>
                    Add your logo
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-extrabold mb-1">Claim your free listing</h2>
                <p className="text-[13px] mb-4" style={{ color: MUTED }}>
                  Free forever for local businesses in {workspace.area}. Takes about a minute.
                </p>
                <form onSubmit={submitHero} className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required placeholder="Business name *" value={hero.businessName} onChange={(e) => setHero({ ...hero, businessName: e.target.value })} className={inputCls} style={inputStyle} />
                    <input required placeholder="Your name *" value={hero.contactName} onChange={(e) => setHero({ ...hero, contactName: e.target.value })} className={inputCls} style={inputStyle} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <input required type="email" placeholder="Email address *" value={hero.email} onChange={(e) => setHero({ ...hero, email: e.target.value })} className={inputCls} style={inputStyle} />
                    <input placeholder="Website or link" value={hero.website} onChange={(e) => setHero({ ...hero, website: e.target.value })} className={inputCls} style={inputStyle} />
                  </div>
                  <select required value={hero.category} onChange={(e) => setHero({ ...hero, category: e.target.value })} className={inputCls} style={{ ...inputStyle, color: hero.category ? INK : MUTED }}>
                    <option value="" disabled>Directory category *</option>
                    {PARTNER_CATEGORIES.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.label}</option>
                    ))}
                  </select>
                  <div>
                    <textarea required rows={2} maxLength={140} placeholder="One or two sentences about your business *" value={hero.description} onChange={(e) => setHero({ ...hero, description: e.target.value })} className={`${inputCls} resize-none`} style={inputStyle} />
                    <p className="text-[11px] text-right" style={{ color: MUTED }}>{hero.description.length}/140</p>
                  </div>
                  {heroError && <p className="text-sm text-red-600">{heroError}</p>}
                  <button type="submit" disabled={heroBusy} className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90" style={{ background: PINE }}>
                    {heroBusy ? "Creating your listing…" : "Get my free listing"}
                  </button>
                  <p className="text-[11px] text-center" style={{ color: MUTED }}>
                    This creates your {workspace.area} listing. Serve both cities? Use the form at the bottom of this page.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* STATS BAND */}
      <section className="border-y bg-white" style={{ borderColor: BORDER }}>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            ["1,069", "Newsletter subscriptions across both markets"],
            ["36%", "Average open rate, last 30 issues"],
            ["31", "Issues opened per reader, last 90 days"],
            ["7 days", "A week, including Saturday and Sunday"],
          ].map(([num, label]) => (
            <div key={label} className="border-l-2 pl-4" style={{ borderColor: BORDER }}>
              <p className="text-3xl sm:text-4xl font-extrabold tracking-tight">{num}</p>
              <p className="text-[13px] mt-1" style={{ color: MUTED }}>{label}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] pb-5 px-4" style={{ color: MUTED }}>
          Audience figures supplied by The Gist, October 2026. Subscriptions are not necessarily unique people across both publications.
        </p>
      </section>

      {/* FREE NETWORK */}
      <section id="free" className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 sm:py-20 scroll-mt-16">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10">
          <div>
            <Eyebrow>The free business network</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4">Start free.<br />Stay visible.</h2>
            <p className="leading-relaxed mb-6" style={{ color: MUTED }}>
              You shouldn&apos;t need an advertising budget just to be part of your local community. The Gist gives
              qualifying local businesses a place to show up and share what&apos;s happening.
            </p>
            <button onClick={() => scrollToId("free-signup")} className="px-5 py-3 rounded-xl text-white font-semibold text-sm inline-flex items-center gap-2 hover:opacity-90 mb-8" style={{ background: PINE_DARK }}>
              Create a free business listing <Arrow />
            </button>
            <div className="rounded-[22px] p-6 text-white" style={{ background: PINE_DARK }}>
              <h3 className="font-extrabold text-lg mb-2">Community participation is already happening.</h3>
              <p className="text-sm leading-relaxed text-emerald-100/90">
                30 businesses joined the free Decatur program, and about 100 community events were submitted across
                six months. Paid sponsorship is optional.
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 content-start">
            {[
              {
                title: "Free Business Directory listing",
                body: "Your profile lives in The Gist's public Business Directory, organized by category so local readers can find you.",
                link: { href: "/partners", label: "Browse the directory" },
              },
              {
                title: "Free event submissions",
                body: "Share qualifying community events for consideration in local calendars and newsletter content.",
              },
              {
                title: "Rotating Business Spotlight",
                body: "Eligible free businesses can appear in the rotating spotlight featuring five businesses daily.",
              },
              {
                title: "Optional upgrades",
                body: "When you have a launch, offer or growth goal, choose paid placements with guaranteed distribution.",
              },
            ].map((card) => (
              <div key={card.title} className="rounded-[22px] border bg-white p-5" style={{ borderColor: BORDER }}>
                <h3 className="font-bold mb-1.5">{card.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{card.body}</p>
                {"link" in card && card.link && (
                  <Link href={card.link.href} className="inline-block mt-3 text-sm font-semibold hover:underline" style={{ color: PINE }}>
                    {card.link.label} →
                  </Link>
                )}
              </div>
            ))}
            <p className="sm:col-span-2 text-xs leading-relaxed" style={{ color: MUTED }}>
              Free listings and event submissions are subject to eligibility and content review. Rotating spotlight
              appearances are not guaranteed. Paid placements are always identified as advertising.
            </p>
          </div>
        </div>
      </section>

      {/* GROW STEPS */}
      <section style={{ background: MINT_BG }}>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <Eyebrow>One relationship. Three levels of involvement.</Eyebrow>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-8">Grow with The Gist when it makes sense for you.</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ["01 / START", "Get listed for free", "Be discoverable in the Business Directory. Share your events. No commitment."],
              ["02 / PROMOTE", "Run a 7-issue campaign", "Put a specific message in every daily edition for one week."],
              ["03 / PARTNER", "Own a familiar presence", "Make The Gist part of your recurring local marketing."],
            ].map(([step, title, body]) => (
              <div key={step} className="rounded-[22px] bg-white border p-6" style={{ borderColor: BORDER }}>
                <p className="text-[11px] font-bold tracking-[0.14em] mb-2" style={{ color: PINE }}>{step}</p>
                <h3 className="font-extrabold text-lg mb-1.5">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="sponsorships" className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 sm:py-20 scroll-mt-16">
        <Eyebrow>Guaranteed promotion</Eyebrow>
        <div className="flex flex-wrap items-end justify-between gap-6 mb-3">
          <div className="max-w-xl">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-3">Ready for a bigger push?</h2>
            <p style={{ color: MUTED }} className="leading-relaxed">
              Two straightforward opportunities. One for something happening now; the other for building recognition over time.
            </p>
          </div>
          <div>
            <div className="inline-flex rounded-full border p-1 bg-white" style={{ borderColor: BORDER }}>
              {(["decatur", "effingham", "both"] as Market[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMarket(m)}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                  style={market === m ? { background: PINE_DARK, color: "#fff" } : { color: MUTED }}
                >
                  {m === "decatur" ? "Decatur" : m === "effingham" ? "Effingham" : "Both cities"}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2 text-right" style={{ color: MUTED }}>{MARKET_LINE[market]}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mt-8">
          {/* Campaign card */}
          <div className="rounded-[22px] border bg-white p-6 sm:p-8 flex flex-col" style={{ borderColor: BORDER }}>
            <div className="flex items-center justify-between mb-5">
              <span className="text-[11px] font-bold tracking-[0.14em] px-3 py-1.5 rounded-full" style={{ background: MINT_BG, color: PINE }}>SHORT-TERM PROMOTION</span>
              <span className="text-xs" style={{ color: MUTED }}>One-time campaign</span>
            </div>
            <p className="text-[11px] font-bold tracking-[0.18em] mb-1" style={{ color: PINE }}>MAKE THIS WEEK COUNT</p>
            <h3 className="text-2xl font-extrabold mb-2">7-Issue Featured Campaign</h3>
            <p className="text-sm leading-relaxed mb-5" style={{ color: MUTED }}>
              Ideal for grand openings, sales, events, seasonal services and anything you want local people to act on now.
            </p>
            <p className="mb-1"><span className="text-5xl font-extrabold tracking-tight">${CAMPAIGN_PRICE[market]}</span> <span style={{ color: MUTED }}>/ 7 issues</span></p>
            <p className="text-sm mb-6" style={{ color: MUTED }}>Seven consecutive daily newsletters, Sunday through Saturday included.</p>
            <ul className="space-y-2.5 text-sm flex-1 mb-7" style={{ color: INK }}>
              {[
                "One clearly labeled featured promotion in each of 7 consecutive daily issues",
                "Your logo or image, concise message and button",
                "Tracked click-throughs to your website, offer or event",
                "Simple campaign results summary",
                "Creative assistance included",
                "No monthly commitment required",
              ].map((item) => (
                <li key={item} className="flex gap-2.5"><span style={{ color: PINE }} className="mt-0.5 shrink-0"><Check /></span>{item}</li>
              ))}
            </ul>
            {market === workspace.slug || market === "both" ? (
              <Link href={campaignHref()} className="block text-center py-3.5 rounded-xl text-white font-semibold text-sm hover:opacity-90" style={{ background: PINE_DARK }}>
                Plan my 7-issue campaign →
              </Link>
            ) : (
              <a href={campaignHref()} className="block text-center py-3.5 rounded-xl text-white font-semibold text-sm hover:opacity-90" style={{ background: PINE_DARK }}>
                Plan my 7-issue campaign →
              </a>
            )}
          </div>

          {/* Partnership card */}
          <div className="rounded-[22px] p-6 sm:p-8 flex flex-col text-white" style={{ background: PINE_DARK }}>
            <div className="flex items-center justify-between mb-5">
              <span className="text-[11px] font-bold tracking-[0.14em] px-3 py-1.5 rounded-full" style={{ background: MINT, color: PINE_DARK }}>LIMITED PARTNER POSITIONS</span>
              <span className="text-xs text-emerald-100/80">Up to 4 per city</span>
            </div>
            <p className="text-[11px] font-bold tracking-[0.18em] mb-1 text-emerald-300">BECOME A FAMILIAR NAME</p>
            <h3 className="text-2xl font-extrabold mb-2">Presenting Partnership</h3>
            <p className="text-sm leading-relaxed mb-5 text-emerald-100/90">
              An ongoing relationship that pairs daily brand presence with recurring promotions and exclusive category positioning.
            </p>
            <p className="mb-1"><span className="text-5xl font-extrabold tracking-tight">${PARTNER_PRICE[market]}</span> <span className="text-emerald-100/80">/ month</span></p>
            <p className="text-sm mb-6 text-emerald-100/90">Billed monthly. Ask about starting with a three-month pilot.</p>
            <ul className="space-y-2.5 text-sm flex-1 mb-7">
              {[
                "Your logo in the partner strip of every daily issue",
                "At least 10 premium promotional features per 30 days, per included city",
                "Exclusive category among Presenting Partners in each city",
                "One clearly labeled sponsored business profile per quarter",
                "Gist Deals offer placement during the partnership",
                "Monthly performance reporting and creative refreshes",
              ].map((item) => (
                <li key={item} className="flex gap-2.5"><span className="mt-0.5 shrink-0" style={{ color: "#18c997" }}><Check /></span>{item}</li>
              ))}
            </ul>
            <button
              onClick={() => { setInterest("partner"); scrollToId("get-started"); }}
              className="block w-full text-center py-3.5 rounded-xl font-semibold text-sm hover:opacity-90"
              style={{ background: MINT, color: PINE_DARK }}
            >
              Discuss a partnership →
            </button>
          </div>
        </div>

        <p className="text-xs leading-relaxed mt-5" style={{ color: MUTED }}>
          <strong style={{ color: INK }}>What&apos;s guaranteed?</strong> The placements described above, subject to available start
          dates and approved creative, not a fixed number of clicks, leads or customers. Partner category exclusivity
          applies only to the Presenting Partner program, not all advertising or independent editorial coverage. Campaign
          pricing is per market, as shown above. The separate Community Board classifieds product is $5/week and
          does not include these newsletter placements.
        </p>

        <div className="rounded-[22px] border mt-5 p-5 sm:p-6 flex flex-wrap items-center gap-4" style={{ borderColor: BORDER, background: MINT_BG }}>
          <div className="flex-1 min-w-[240px]">
            <h3 className="font-extrabold mb-1">Want to sponsor something specific?</h3>
            <p className="text-sm" style={{ color: MUTED }}>Ask about presenting a community calendar, weekend guide, event series or other useful newsletter feature. Availability and pricing are customized.</p>
          </div>
          <button onClick={() => { setInterest("partner"); scrollToId("get-started"); }} className="font-semibold text-sm hover:underline" style={{ color: PINE_DARK }}>
            Explore a custom idea →
          </button>
        </div>

        {/* Comparison table */}
        <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-14 mb-4">At a glance: what&apos;s free and what&apos;s paid?</h3>
        <div className="overflow-x-auto rounded-[22px] border bg-white" style={{ borderColor: BORDER }}>
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left" style={{ background: MINT_BG }}>
                <th className="px-5 py-3.5 font-bold">Included benefit</th>
                <th className="px-5 py-3.5 font-bold">Free listing</th>
                <th className="px-5 py-3.5 font-bold">7-issue campaign</th>
                <th className="px-5 py-3.5 font-bold">Presenting Partner</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Business profile in the free directory and event submissions", "Included", "Included", "Included"],
                ["Rotating Business Spotlight", "Eligible", "Eligible", "Eligible"],
                ["Guaranteed promotional placement", "—", "7 daily issues", "10 per 30 days"],
                ["Logo in every newsletter issue", "—", "—", "Yes"],
                ["Category exclusivity in the partner program", "—", "—", "Yes"],
                ["Campaign performance summary", "—", "Yes", "Monthly"],
                ["Quarterly sponsored business profile", "—", "—", "Yes"],
              ].map(([benefit, free, campaign, partner]) => (
                <tr key={benefit} className="border-t" style={{ borderColor: BORDER }}>
                  <td className="px-5 py-3 font-medium">{benefit}</td>
                  <td className="px-5 py-3" style={{ color: free === "—" ? MUTED : PINE }}>{free}</td>
                  <td className="px-5 py-3" style={{ color: campaign === "—" ? MUTED : PINE }}>{campaign}</td>
                  <td className="px-5 py-3" style={{ color: partner === "—" ? MUTED : PINE }}>{partner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PROOF */}
      <section id="proof" className="scroll-mt-16" style={{ background: CREAM_DARK }}>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10">
          <div>
            <Eyebrow>Local audience. Real response.</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4">Small-town focus.<br />Measurable activity.</h2>
            <p className="leading-relaxed mb-5" style={{ color: MUTED }}>
              The Gist doesn&apos;t promise the cheapest clicks on the internet. We offer repeated opportunities to get
              in front of an audience that chooses to read local news and happenings.
            </p>
            <p className="text-sm font-semibold leading-relaxed">
              Decatur: 681 subscriptions · 15-mile editorial radius<br />
              Effingham: 388 subscriptions · 30-mile editorial radius
            </p>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                ["15,679", "Recorded sponsored-placement impressions to date"],
                ["272", "Clicks on sponsored placements to date"],
                ["3.5%", "Historical click-through rate for Presenting placements"],
                ["10 AM", "Daily delivery, Sunday through Saturday"],
              ].map(([num, label]) => (
                <div key={label} className="rounded-[22px] bg-white border p-5" style={{ borderColor: BORDER }}>
                  <p className="text-3xl font-extrabold tracking-tight" style={{ color: PINE }}>{num}</p>
                  <p className="text-[13px] mt-1" style={{ color: MUTED }}>{label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-[22px] p-6 text-white" style={{ background: PINE_DARK }}>
              <p className="text-[11px] font-bold tracking-[0.18em] mb-2 text-emerald-300">REAL HISTORICAL EXAMPLE</p>
              <h3 className="font-extrabold text-lg leading-snug mb-2">Recent five-issue Presenting runs delivered roughly 1,200 impressions and over 30 clicks each.</h3>
              <p className="text-[13px] leading-relaxed text-emerald-100/90">
                These results reflect the previous five-issue format, not a forecast for the new seven-issue campaign.
                Sponsorship results vary by offer, creative and business.
              </p>
            </div>
            <p className="text-[11px] leading-relaxed mt-3" style={{ color: MUTED }}>
              Source: The Gist&apos;s own historical reporting. Open rates and email impressions can be affected by mail
              privacy features; customer actions are more useful when measuring return on investment. No clicks or leads are guaranteed.
            </p>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <Eyebrow>Why local businesses choose The Gist</Eyebrow>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-3">More than a banner ad.</h2>
        <p className="leading-relaxed mb-8 max-w-2xl" style={{ color: MUTED }}>
          When you&apos;re sponsoring local information people seek out, you&apos;re buying a different kind of opportunity
          than a general social-media impression.
        </p>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          {[
            ["Geographic relevance", "Two newsletters designed around the communities near Decatur and Effingham, with local editorial coverage rather than broad national reach."],
            ["Repeated visibility", "Readers can encounter your brand over successive daily issues instead of only during an isolated campaign impression."],
            ["Something to measure", "Track clicks to an offer, registration, quote request or product page. Connect follow-through tracking to assess genuine business results."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[22px] border bg-white p-6" style={{ borderColor: BORDER }}>
              <h3 className="font-extrabold mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[22px] p-5 sm:p-6 border-l-4" style={{ background: MINT_BG, borderColor: PINE }}>
          <p className="text-sm leading-relaxed">
            <strong>&ldquo;Wouldn&apos;t Facebook or Instagram ads be cheaper?&rdquo;</strong> They may be, especially if your
            goal is high-volume, low-cost website traffic. The Gist is different: a consistent local-news context and
            recurring brand visibility. Businesses can use both; compare actual leads or customers, not only clicks.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16" style={{ background: MINT_BG }}>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-[1fr_1.4fr] gap-10">
          <div>
            <Eyebrow>Straight answers</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-3">Good questions, answered.</h2>
            <p style={{ color: MUTED }}>No confusing packages or fine-print surprises. Here&apos;s how the opportunities work.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={f.q} className="rounded-2xl bg-white border overflow-hidden" style={{ borderColor: BORDER }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-semibold text-sm sm:text-[15px]">
                  {f.q}
                  <span className="text-lg leading-none shrink-0" style={{ color: PINE }}>{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: MUTED }}>{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM FORM */}
      <section id="get-started" className="scroll-mt-16" style={{ background: PINE_DEEP }}>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-10 items-start">
          <div className="text-white">
            <Eyebrow light>Let&apos;s get your business seen</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4">Start free. Stand out when you&apos;re ready.</h2>
            <p className="leading-relaxed mb-6 text-emerald-100/90">
              Tell us a little about your business. Start with your free listing, plan a seven-issue promotion, or ask
              about becoming a Presenting Partner.
            </p>
            <ul className="space-y-2.5 text-sm">
              {["One place for free listings and paid sponsorship", "Decatur, Effingham, or both", "Local promotion with clear deliverables"].map((item) => (
                <li key={item} className="flex gap-2.5"><span className="mt-0.5 shrink-0" style={{ color: "#18c997" }}><Check /></span>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[22px] bg-white p-5 sm:p-7">
            {leadDone ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: MINT_BG, color: PINE }}>
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold mb-2">
                  {leadDone === "partner" ? "Thanks, we'll be in touch." : "You're on your way."}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  {leadDone === "partner"
                    ? "Your inquiry is in Chad's inbox and your sponsor portal link is on its way to your email. He'll reach out to talk through the partnership."
                    : "Your sponsor portal link is on its way to your email. Use it to finish your free directory listing and submit events."}
                </p>
                <Link href="/partners" className="inline-block mt-5 px-4 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: PINE_DARK }}>
                  Browse the Business Directory
                </Link>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-extrabold mb-1">What would you like to do?</h3>
                <p className="text-[13px] mb-4" style={{ color: MUTED }}>Choose an option. Your business can always start with the free listing.</p>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {([
                    ["free", "Free listing"],
                    ["campaign", "7-issue ad"],
                    ["partner", "Partnership"],
                  ] as [Interest, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterest(value)}
                      className="px-2 py-2.5 rounded-xl border text-[13px] font-semibold transition-colors"
                      style={interest === value ? { background: PINE_DARK, color: "#fff", borderColor: PINE_DARK } : { borderColor: BORDER, color: MUTED }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <form onSubmit={submitLead} className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Business name *</label>
                      <input required placeholder="Your business" value={lead.businessName} onChange={(e) => setLead({ ...lead, businessName: e.target.value })} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Your name *</label>
                      <input required placeholder="Your name" value={lead.contactName} onChange={(e) => setLead({ ...lead, contactName: e.target.value })} className={inputCls} style={inputStyle} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Email address *</label>
                      <input required type="email" placeholder="name@business.com" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>Where do you serve? *</label>
                      <select value={market} onChange={(e) => setMarket(e.target.value as Market)} className={inputCls} style={inputStyle}>
                        <option value="decatur">Decatur area</option>
                        <option value="effingham">Effingham area</option>
                        <option value="both">Both communities</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: MUTED }}>What would you like people to know? <span className="font-normal">(optional)</span></label>
                    <textarea rows={3} placeholder="Tell us about your business, event, offer or marketing goal." value={lead.goal} onChange={(e) => setLead({ ...lead, goal: e.target.value })} className={`${inputCls} resize-none`} style={inputStyle} />
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                    {interest === "free"
                      ? "A free listing does not require a purchase. Free profiles and event submissions are subject to local eligibility and review."
                      : interest === "campaign"
                        ? "A 7-issue campaign includes seven consecutive daily newsletters, weekends included. Placement availability and creative are confirmed before purchase."
                        : "Partnerships are billed monthly. Category exclusivity and placement guarantees will be confirmed in your agreement."}
                  </p>
                  {leadError && <p className="text-sm text-red-600">{leadError}</p>}
                  <button type="submit" disabled={leadBusy} className="w-full py-3.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 hover:opacity-90 inline-flex items-center justify-center gap-2" style={{ background: PINE }}>
                    {leadBusy
                      ? "One moment…"
                      : interest === "free"
                        ? <>Start my free listing <Arrow /></>
                        : interest === "campaign"
                          ? <>Plan my 7-issue campaign <Arrow /></>
                          : <>Ask about a partnership <Arrow /></>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
        <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-white font-extrabold text-lg">The Gist <span className="block text-xs font-normal text-emerald-100/70">Local news, events and businesses, Decatur & Effingham.</span></p>
            <div className="flex gap-5 text-sm text-emerald-100/85">
              <button onClick={() => scrollToId("free")} className="hover:underline">Free marketing</button>
              <button onClick={() => scrollToId("sponsorships")} className="hover:underline">Sponsorships</button>
              <button onClick={() => scrollToId("proof")} className="hover:underline">Audience</button>
              <button onClick={() => scrollToId("faq")} className="hover:underline">FAQs</button>
            </div>
            <p className="text-xs text-emerald-100/60">© 2026 The Gist.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
