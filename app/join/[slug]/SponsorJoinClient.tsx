"use client";

import { useState, useEffect } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";
import DealsOto from "@/components/DealsOto";
import SponsorsMarquee from "@/components/SponsorsMarquee";
import type { SponsorFeaturedCard } from "@/lib/sponsor-kit";

// The /join landing page, mirrored for one inviting sponsor (Sponsor
// Amp Kit). Differences from /join, all deliberate:
// - The hero's side visual is the sponsor's Community Partner card
//   instead of the fanned latest-issue cards.
// - A line names the inviting business by the form.
// - Signup attribution defaults to this sponsor (utmSource "sponsor",
//   utmCampaign the canonical slug, utmMedium "link"); UTM params on
//   the page URL itself (the printed QR bakes in utm_medium=flyer)
//   override those defaults when present.
// - No /join A/B variant or join-test-event logging: sponsor traffic
//   must not pollute the /join landing test.

interface JoinData {
  count: number;
  rounded: number;
  latestIssue: {
    subject: string;
    sentAt: string;
    recipientCount: number;
    stories: { title: string; desc: string }[];
    games: string[];
  } | null;
}

interface Props {
  sponsorName: string;
  sponsorSlug: string;
  card: SponsorFeaturedCard;
}

function SponsorJoinForm({
  compact = false,
  sponsorSlug,
}: {
  compact?: boolean;
  sponsorSlug: string;
}) {
  const { workspace } = useWorkspace();
  const [email, setEmail] = useState("");
  const [subscribedEmail, setSubscribedEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      // Attribution: page-URL UTMs win (the QR code's baked-in flyer
      // params), then this sponsor's defaults.
      const params = new URLSearchParams(window.location.search);
      const res = await workspaceFetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          utmSource: params.get("utm_source") || "sponsor",
          utmMedium: params.get("utm_medium") || "link",
          utmCampaign: params.get("utm_campaign") || sponsorSlug,
          referrer: document.referrer || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "You're in! Welcome to " + workspace.name + ".");
        setSubscribedEmail(email);
        setEmail("");
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

  if (status === "success") {
    return (
      <div className={compact ? "" : "max-w-md"}>
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
        <DealsOto area={workspace.area} email={subscribedEmail} src="join" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "max-w-md" : "max-w-md w-full"}>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-400 bg-white"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {status === "loading" ? "…" : "Get it free"}
        </button>
      </div>
      {status === "error" && <p className="text-red-500 text-sm mt-2">{message}</p>}
      <p className="text-xs text-gray-400 mt-3">Free forever. No spam. Unsubscribe anytime.</p>
    </form>
  );
}

// "2026-10-13" in America/Chicago, for send-day comparisons
function ctDay(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

function sentTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

function gamesLine(games: string[]): string {
  if (games.length === 0) return "Fresh games with your morning coffee.";
  if (games.length === 1) return `${games[0]}, fresh every morning.`;
  if (games.length === 2) return `${games[0]} and ${games[1]}, fresh every morning.`;
  return `${games.slice(0, -1).join(", ")}, and ${games[games.length - 1]}, fresh every morning.`;
}

// The sponsor's featured card, same card as /partners, presented as the
// hero visual in place of the fanned issue cards.
function SponsorCard({ card, sponsorName }: { card: SponsorFeaturedCard; sponsorName: string }) {
  return (
    <div className="relative">
      <p className="text-[11px] font-bold text-green-700 tracking-[0.08em] mb-3 text-center lg:text-left">
        {sponsorName.toUpperCase()} INVITES YOU TO JOIN
      </p>
      <div className="bg-white border border-[#ece7dd] rounded-2xl p-6 sm:p-7 shadow-[0_12px_30px_rgba(0,0,0,0.08)] max-w-md mx-auto lg:mx-0">
        <div className="flex items-center gap-4 mb-3">
          {card.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.logoUrl}
              alt={card.businessName}
              className="w-14 h-14 object-contain rounded shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded bg-green-100 flex items-center justify-center shrink-0">
              <span className="text-green-700 font-bold text-xl">
                {card.businessName.charAt(0)}
              </span>
            </div>
          )}
          <p className="font-bold text-gray-900 leading-snug text-lg">{card.businessName}</p>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
        {card.ctaUrl && (
          <a
            href={card.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 px-4 py-2 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
          >
            {card.ctaLabel || "Visit Website"}
          </a>
        )}
        <p className="text-xs text-gray-400 mt-5 pt-4 border-t border-[#ece7dd]">
          A Community Partner of this newsletter. Local businesses like{" "}
          {card.businessName} help keep it free for everyone in town.
        </p>
      </div>
    </div>
  );
}

export default function SponsorJoinClient({ sponsorName, sponsorSlug, card }: Props) {
  const { workspace } = useWorkspace();
  const [data, setData] = useState<JoinData | null>(null);

  useEffect(() => {
    workspaceFetch("/api/join-data")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => null);
  }, []);

  const rounded = data?.rounded ?? null;
  const issue = data?.latestIssue ?? null;
  const stories = issue?.stories ?? [];
  const showProof = rounded !== null && rounded >= 10;
  const isToday = issue ? ctDay(issue.sentAt) === ctDay(new Date()) : false;
  const issueDateLabel = issue
    ? new Date(issue.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" })
    : "";
  const dateline = new Date()
    .toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    .toUpperCase();
  const heroImage =
    workspace.heroImageUrl ?? (workspace.slug === "effingham" ? "/join-hero.png" : "/join-hero-decatur.png");

  const faqs = [
    {
      q: "Is it really free?",
      a: "Yes. Free forever. The newsletter will never cost you anything.",
    },
    {
      q: "Will you sell my email or spam me?",
      a: "Never. One email a day, and you can unsubscribe with one click anytime. No hard feelings.",
    },
    {
      q: "When does it arrive?",
      a: "Every morning, in time for coffee. Two-minute read, then you're caught up.",
    },
    {
      q: `I live between cities: ${workspace.area} or the other edition?`,
      a: "Pick the city you live and shop in most. Each edition is written specifically for its town.",
    },
    {
      q: "What if I don't like it?",
      a: "Unsubscribe in one click from any issue. But give it a week. Most people wonder how they kept up before.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f4] flex flex-col">
      <SiteHeader />
      {/* Dateline line under the shared nav */}
      <div className="border-b border-[#ece7dd] bg-[#faf8f4]">
        <p className="max-w-5xl mx-auto px-4 sm:px-6 py-2 text-[11px] sm:text-xs text-[#8a8478] tracking-[0.08em] font-medium text-center">
          {dateline} &middot; {workspace.area.toUpperCase()}, IL
        </p>
      </div>

      <main className="flex-1">
        {/* ── HERO with aerial background ── */}
        <section className="relative overflow-hidden">
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-right"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/60 to-transparent"
          />
          <div className="relative max-w-5xl mx-auto px-6 pt-10 pb-14 sm:pt-16 sm:pb-20 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              {showProof && (
                <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-green-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                  Join {rounded!.toLocaleString()}+ {workspace.area} neighbors
                </div>
              )}

              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-5">
                Everything worth knowing in {workspace.area}, every morning.
              </h1>
              <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
                A free 2-minute daily email. The local stories, events, and deals
                that actually matter. No algorithms, no doomscrolling.
              </p>

              <SponsorJoinForm sponsorSlug={sponsorSlug} />
              <p className="text-xs text-gray-400 mt-3">
                Brought to you with {sponsorName}, a local business that stands behind {workspace.name}.
              </p>
            </div>

            {/* Sponsor's featured listing card instead of the issue cards */}
            <SponsorCard card={card} sponsorName={sponsorName} />
          </div>
        </section>

        <SponsorsMarquee />

        {/* ── INSIDE THE LATEST ISSUE ── */}
        {stories.length > 0 && (
          <section className="bg-white border-y border-[#ece7dd] py-14 sm:py-16">
            <div className="max-w-5xl mx-auto px-6">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-3 text-center">
                Inside {isToday ? "today's" : `the ${issueDateLabel}`} issue
              </h2>
              <p className="text-gray-500 text-center mb-10 max-w-xl mx-auto">
                This is what landed in {workspace.area} inboxes {isToday ? "this morning" : `on ${issueDateLabel}`}. Word for word.
              </p>
              <div className="max-w-2xl mx-auto border border-[#ece7dd] rounded-2xl overflow-hidden">
                {stories.slice(0, 5).map((s) => (
                  <div key={s.title} className="px-6 py-[18px] border-b border-[#ece7dd] last:border-b-0 bg-white">
                    <p className="font-bold text-gray-900 text-[15px] leading-snug">{s.title}</p>
                    {s.desc && <p className="text-[13px] text-gray-500 mt-1 leading-relaxed line-clamp-2">{s.desc}</p>}
                  </div>
                ))}
              </div>
              <p className="text-center mt-5 text-[13px] text-[#8a8478]">
                Every story above appeared in {isToday ? "this morning's" : `the ${issueDateLabel}`} send.
              </p>
            </div>
          </section>
        )}

        {/* ── WHY READERS STAY: marketing cards ── */}
        <section className="py-14 sm:py-16">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-3 text-center">
              Why {workspace.area} reads it
            </h2>
            <p className="text-gray-500 text-center mb-10 max-w-xl mx-auto">
              More than a newsletter. A morning habit.
            </p>
            <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
              {/* CARD 1: FOMO */}
              {issue && stories.length > 0 && showProof && (
                <div className="bg-[#0c1f14] rounded-[20px] p-7 sm:p-8 text-white">
                  <p className="text-[11px] font-bold tracking-[0.12em] text-green-300 mb-3">
                    {isToday ? "YOU MISSED IT THIS MORNING" : "IN CASE YOU MISSED IT"}
                  </p>
                  <p className="text-xl font-extrabold leading-snug mb-3">
                    This hit {rounded!.toLocaleString()}+ {workspace.area} inboxes
                    {isToday ? ` at ${sentTime(issue.sentAt)}` : ` on ${issueDateLabel}`}.
                  </p>
                  <div className="text-sm text-white/75 leading-relaxed space-y-1.5 mb-4">
                    {stories.slice(0, 2).map((s) => (
                      <p key={s.title}>&rarr; {s.title}</p>
                    ))}
                  </div>
                  <p className="text-sm text-green-300 font-bold">Tomorrow&apos;s issue can hit yours.</p>
                </div>
              )}

              {/* CARD 2: the trade */}
              <div className="bg-white border border-[#ece7dd] rounded-[20px] p-7 sm:p-8">
                <p className="text-[11px] font-bold tracking-[0.12em] text-green-700 mb-4">THE 2-MINUTE TRADE</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 rounded-xl p-4">
                    <p className="text-[13px] font-bold text-red-800 mb-1.5">20 min scrolling</p>
                    <p className="text-[13px] text-gray-500 leading-relaxed">
                      Endless feed. Maybe some local news. Probably your cousin&apos;s politics. Zero idea what&apos;s actually happening in {workspace.area}.
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-[13px] font-bold text-green-800 mb-1.5">2 min with The Gist</p>
                    <p className="text-[13px] text-gray-500 leading-relaxed">
                      Top stories. This week&apos;s events. The deals worth knowing. Done before your coffee cools.
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD 3: more than headlines */}
              <div className="bg-white border border-[#ece7dd] rounded-[20px] p-7 sm:p-8">
                <p className="text-[11px] font-bold tracking-[0.12em] text-green-700 mb-3">MORE THAN HEADLINES</p>
                <p className="text-xl font-extrabold text-gray-900 leading-snug mb-5">
                  It&apos;s the best two minutes of your morning.
                </p>
                <div className="space-y-3.5">
                  <div className="flex gap-3 items-start text-sm">
                    <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-base shrink-0">🎮</span>
                    <span><strong className="text-gray-900">Daily games.</strong> <span className="text-gray-500">{issue ? gamesLine(issue.games) : "Fresh games with your morning coffee."}</span></span>
                  </div>
                  <div className="flex gap-3 items-start text-sm">
                    <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-base shrink-0">🏷️</span>
                    <span><strong className="text-gray-900">Deals worth knowing.</strong> <span className="text-gray-500">The week&apos;s best grocery deals and local coupons.</span></span>
                  </div>
                  <div className="flex gap-3 items-start text-sm">
                    <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-base shrink-0">📅</span>
                    <span><strong className="text-gray-900">Things to do.</strong> <span className="text-gray-500">Events around town, before everyone else hears.</span></span>
                  </div>
                </div>
              </div>

              {/* CARD 4: zero risk */}
              <div className="bg-white border border-[#ece7dd] rounded-[20px] p-7 sm:p-8 text-center flex flex-col justify-center">
                <p className="text-[11px] font-bold tracking-[0.12em] text-green-700 mb-3">ZERO RISK</p>
                <p className="text-xl font-extrabold text-gray-900 mb-5">Try a week. Leave whenever.</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {["Free forever", "No paywall", "No spam, ever", "One-click unsubscribe"].map((t) => (
                    <span key={t} className="text-[13px] font-semibold bg-green-50 text-green-700 px-4 py-2 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white border-y border-[#ece7dd] py-14 sm:py-16">
          <div className="max-w-2xl mx-auto px-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-8 text-center">
              Questions, answered.
            </h2>
            <div className="space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="bg-[#faf8f4] rounded-2xl border border-[#ece7dd] px-6 py-4 group">
                  <summary className="font-bold text-gray-900 text-[15px] cursor-pointer list-none flex items-center justify-between">
                    {f.q}
                    <span className="text-green-700 text-lg leading-none group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="text-sm text-gray-500 leading-relaxed mt-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA with workspace hero image ── */}
        <section className="py-14 sm:py-20">
          <div className="max-w-5xl mx-auto px-6 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] items-center">
            <div>
              <img
                src={heroImage}
                alt={`${workspace.area}, Illinois`}
                className="w-full rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.10)]"
              />
              <p className="text-xs text-[#8a8478] mt-3 text-center">{workspace.area}, Illinois</p>
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
                Join {workspace.area}&apos;s morning routine.
              </h2>
              <p className="text-gray-500 mb-8">Free forever. One email a day. No fluff.</p>
              <SponsorJoinForm compact sponsorSlug={sponsorSlug} />
            </div>
          </div>
        </section>
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-[#ece7dd] py-6">
        <div className="max-w-5xl mx-auto px-6 text-center text-xs text-[#8a8478]">
          &copy; {new Date().getFullYear()} {workspace.name} &middot;{" "}
          <Link href="/unsubscribe" className="hover:text-gray-600 transition-colors">Unsubscribe</Link>
          {" "}&middot;{" "}
          <Link href="/policy" className="hover:text-gray-600 transition-colors">Policies</Link>
        </div>
      </footer>
    </div>
  );
}
