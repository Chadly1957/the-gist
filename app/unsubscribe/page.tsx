"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("done");
      } else {
        setErrorMsg(data.error || "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Connection error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re unsubscribed</h2>
        <p className="text-gray-500 text-sm">
          {email} has been removed from The Gist Decatur.
          You won&apos;t receive any more emails from us.
        </p>
        <p className="text-gray-400 text-xs mt-4">
          Changed your mind?{" "}
          <a href="/" className="text-green-700 underline hover:text-green-800">
            Resubscribe here
          </a>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          <span className="font-bold text-gray-800 text-sm tracking-tight">The Gist Decatur</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribe</h1>
        <p className="text-gray-500 text-sm">
          Enter your email address below to stop receiving The Gist Decatur.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-gray-600 mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {status === "error" && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === "loading" || !email}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          {status === "loading" ? "Unsubscribing…" : "Unsubscribe"}
        </button>
      </form>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <Suspense>
          <UnsubscribeForm />
        </Suspense>
      </div>
    </div>
  );
}
