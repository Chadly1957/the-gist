"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "You're in! Welcome to The Gist Decatur.");
        setEmail("");
        setFirstName("");
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
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="h-14 w-auto" />
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/sponsor" className="text-sm font-semibold text-green-700 hover:text-green-800 transition-colors">
              Advertise
            </Link>
            <Link href="/admin/login" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ── HERO ── */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: copy + form */}
            <div>
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-green-100 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                Free · Daily · Local
              </div>

              <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-[1.08] tracking-tight mb-6">
                The stories<br />
                that matter<br />
                <span className="text-green-700">in Decatur.</span>
              </h1>

              <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-md">
                Every morning, The Gist Decatur curates the most important local news, events, and conversations in a quick read you&apos;ll actually finish.
              </p>

              {status === "success" ? (
                <div className="flex items-start gap-4 bg-green-50 border border-green-100 rounded-2xl p-6 max-w-md">
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
              ) : (
                <form onSubmit={handleSubmit} className="max-w-md space-y-3">
                  <input
                    type="text"
                    placeholder="First name (optional)"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-400"
                  />
                  <div className="flex gap-2">
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
                      className="bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-3.5 rounded-xl text-sm transition-colors disabled:opacity-60 whitespace-nowrap"
                    >
                      {status === "loading" ? "…" : "Subscribe"}
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

            {/* Right: Decatur photo */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-full max-w-md">
                <div className="rounded-3xl overflow-hidden">
                  <Image
                    src="/hero-decatur.jpg"
                    alt="Historic Decatur pavilion"
                    width={640}
                    height={700}
                    className="w-full h-auto object-cover"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHAT YOU GET ── */}
        <section className="bg-gray-50 border-y border-gray-100 py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
                What&apos;s in each issue?
              </h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Everything you need to know about Decatur, delivered in under two minutes.
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
                  desc: "Curated articles from trusted Decatur sources, delivered fresh each morning.",
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
                  desc: "No algorithms. No doomscrolling. Just your daily Decatur digest, right in your email.",
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
          </div>
        </section>

        {/* ── SPONSORSHIP CTA ── */}
        <section className="bg-green-900 py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: copy */}
              <div>
                <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-4">For Local Businesses</p>
                <h2 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
                  Reach Decatur<br />readers every day.
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
                    name: "Small Business Spotlight",
                    price: "Free",
                    desc: "Rotating listing with logo, description, and CTA in every issue.",
                    accent: "bg-green-800 border-green-700",
                  },
                  {
                    name: "In-Article Sponsorship",
                    price: "$15 / day",
                    desc: "Sponsored post mixed in with the day's news. Up to 2 slots per day.",
                    accent: "bg-green-800 border-green-700",
                  },
                  {
                    name: "Presenting Sponsor",
                    price: "$25 / day",
                    desc: "Opening mention + full in-article ad. Exclusive: one per day.",
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
        <section className="py-20">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
              Join Decatur&apos;s daily briefing.
            </h2>
            <p className="text-gray-500 mb-8">Free forever. One email a day. No fluff.</p>
            {status === "success" ? (
              <div className="bg-green-50 border border-green-100 rounded-2xl p-6">
                <p className="font-bold text-green-800 mb-1">You&apos;re subscribed!</p>
                <p className="text-sm text-green-600">{message}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
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
                  className="bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-3.5 rounded-xl text-sm transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  {status === "loading" ? "…" : "Subscribe free"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <Link href="/sponsor" className="hover:text-gray-600 transition-colors">Advertise</Link>
            <Link href="/unsubscribe" className="hover:text-gray-600 transition-colors">Unsubscribe</Link>
            <span>&copy; {new Date().getFullYear()} The Gist Decatur</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
