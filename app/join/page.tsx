"use client";

import { useState, useEffect } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";
import DealsOto from "@/components/DealsOto";
import RecentIssues from "@/components/RecentIssues";

// Dedicated landing page for paid ad traffic. Single purpose: email signup.
// No nav links, no sponsor section, no distractions — subscribe or leave.
// NOTE for the next ad run: the ad's primary text should echo the hero
// headline below word for word (message match is the #1 CRO lever).
function JoinForm({ compact = false }: { compact?: boolean }) {
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
      const res = await workspaceFetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "You're in! Welcome to " + workspace.name + ".");
        setSubscribedEmail(email);
        setEmail("");
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
    <form onSubmit={handleSubmit} className={compact ? "max-w-md mx-auto" : "max-w-md w-full"}>
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
          className="bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {status === "loading" ? "…" : "Subscribe"}
        </button>
      </div>
      {status === "error" && <p className="text-red-500 text-sm mt-2">{message}</p>}
      <p className="text-xs text-gray-400 mt-3">Free forever. No spam. Unsubscribe anytime.</p>
    </form>
  );
}

export default function JoinPage() {
  const { workspace } = useWorkspace();
  const [subCount, setSubCount] = useState<number | null>(null);

  useEffect(() => {
    workspaceFetch("/api/subscriber-count")
      .then((r) => r.json())
      .then((d) => setSubCount(d.rounded ?? null))
      .catch(() => null);
  }, []);

  const faqs = [
    {
      q: "Is it really free?",
      a: "Yes — free forever. The newsletter will never cost you anything. (There's a separate optional Deals book for $15, but the daily email is free.)",
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
      q: `I live between cities — ${workspace.area} or the other edition?`,
      a: "Pick the city you live and shop in most. Each edition is written specifically for its town.",
    },
    {
      q: "What if I don't like it?",
      a: "Unsubscribe in one click from any issue. But give it a week — most people wonder how they kept up before.",
    },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal header: logo only, no nav */}
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/">
            <Logo className="h-10 w-auto" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ── HERO: form above the fold ── */}
        <section className="max-w-3xl mx-auto px-6 pt-12 pb-14 sm:pt-20 sm:pb-20">
          {subCount !== null && subCount >= 10 && (
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
              Join {subCount.toLocaleString()}+ {workspace.area} neighbors
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-5">
            Everything worth knowing in {workspace.area}, every morning.
          </h1>
          <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
            A free 2-minute daily email. The local stories, events, and deals
            that actually matter &mdash; no algorithms, no doomscrolling.
          </p>

          <JoinForm />
        </section>

        {/* ── WHAT'S INSIDE ── */}
        <section className="bg-gray-50 border-y border-gray-100 py-14">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-8 text-center">
              What&apos;s in each issue?
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { t: "Top local stories", d: `The day's most important ${workspace.area} news, curated from trusted local sources.` },
                { t: "Events & things to do", d: "What's happening around town this week — so you never miss out." },
                { t: "Deals worth knowing", d: "Local discounts and savings, plus a peek at the weekly store ads." },
              ].map((item) => (
                <div key={item.t} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-2 text-[15px]">{item.t}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="py-14">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-8 text-center">
              How it works
            </h2>
            <ol className="space-y-3 max-w-xl mx-auto">
              {[
                { n: "1", t: "Drop in your email", d: "Ten seconds. That's the whole signup." },
                { n: "2", t: "Get it every morning", d: "One email, two minutes, with your coffee." },
                { n: "3", t: "Never miss local again", d: "News, events, and deals — before everyone else hears." },
              ].map((s) => (
                <li key={s.n} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-4 items-start">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-green-700 text-white font-bold flex items-center justify-center text-sm">
                    {s.n}
                  </span>
                  <div>
                    <p className="font-bold text-gray-900">{s.t}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <RecentIssues />

        {/* ── FAQ ── */}
        <section className="bg-gray-50 border-y border-gray-100 py-14">
          <div className="max-w-2xl mx-auto px-6">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-8 text-center">
              Questions? Good.
            </h2>
            <div className="space-y-3">
              {faqs.map((f) => (
                <details key={f.q} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 group">
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

        {/* ── FINAL CTA ── */}
        <section className="py-14 sm:py-20">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
              Join {workspace.area}&apos;s morning routine.
            </h2>
            <p className="text-gray-500 mb-8">Free forever. One email a day. No fluff.</p>
            <JoinForm compact />
          </div>
        </section>
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-gray-100 py-6">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} {workspace.name} &middot;{" "}
          <Link href="/unsubscribe" className="hover:text-gray-600 transition-colors">Unsubscribe</Link>
        </div>
      </footer>
    </div>
  );
}
