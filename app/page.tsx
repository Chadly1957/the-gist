"use client";

import { useState } from "react";

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
        setMessage(data.message || "You're in! Check your inbox.");
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
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-700 inline-block" />
            <span className="font-semibold text-gray-900 tracking-tight text-lg">
              The Gist Decatur
            </span>
          </div>
          <span className="text-sm text-gray-400 font-medium">Free newsletter</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-8 border border-green-100">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            Free. Daily. Local.
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
            The stories that
            <br />
            <span className="text-green-700">matter in Decatur.</span>
          </h1>

          <p className="text-xl text-gray-500 leading-relaxed max-w-xl mx-auto mb-12">
            Every morning, The Gist Decatur curates the most important local
            news, events, and conversations — in a quick read you'll actually
            finish.
          </p>

          {/* Signup Card */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 max-w-md mx-auto">
            {status === "success" ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">You're subscribed!</h3>
                <p className="text-gray-500 text-sm">{message}</p>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Get the daily briefing
                </h2>
                <p className="text-sm text-gray-400 mb-6">
                  Join thousands of Decatur locals. Free forever.
                </p>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="text"
                    placeholder="First name (optional)"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <input
                    type="email"
                    placeholder="Your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />

                  {status === "error" && (
                    <p className="text-red-500 text-sm text-left">{message}</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 px-6 rounded-xl text-sm transition-colors disabled:opacity-60"
                  >
                    {status === "loading" ? "Subscribing…" : "Subscribe — it's free"}
                  </button>
                </form>

                <p className="text-xs text-gray-400 mt-4 text-center">
                  No spam. Unsubscribe anytime.
                </p>
              </>
            )}
          </div>
        </section>

        {/* What you get */}
        <section className="bg-gray-50 border-t border-gray-100 py-16">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
              What's in each issue?
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                    </svg>
                  ),
                  title: "Top Local Stories",
                  desc: "Curated articles from trusted Decatur sources, delivered fresh each morning.",
                },
                {
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: "2-Minute Read",
                  desc: "Concise summaries so you stay informed without spending your whole morning reading.",
                },
                {
                  icon: (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ),
                  title: "Straight to Inbox",
                  desc: "No algorithms. No doomscrolling. Just your daily Decatur digest, right in your email.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 flex items-center justify-center mb-4">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-700 inline-block" />
            <span className="font-semibold text-gray-700 text-sm">The Gist Decatur</span>
          </div>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} The Gist Decatur. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
