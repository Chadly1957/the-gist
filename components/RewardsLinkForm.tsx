"use client";

import { useState } from "react";
import Link from "@/components/workspace/WorkspaceLink";
import { workspaceFetch } from "@/lib/workspace-client";

// "Email me my Rewards link" form, shared by the homepage Rewards section
// and the /rewards entry page. Posts to /api/rewards/link, which always
// answers with the same neutral message (it never reveals whether an
// email is subscribed); the personal link itself arrives by email.
export default function RewardsLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await workspaceFetch("/api/rewards/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("sent");
        setMessage(data.message || "If that email is subscribed, we've sent your personal Rewards link.");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3.5">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm mb-0.5">Check your inbox</p>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setEmail("");
            setMessage("");
          }}
          className="text-xs text-gray-400 underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          required
          aria-label="Email address"
          className="flex-1 px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder:text-gray-400 bg-white"
        />
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-3.5 rounded-xl text-sm transition-colors whitespace-nowrap w-full sm:w-auto"
        >
          {status === "loading" ? "Sending…" : "Email My Link"}
        </button>
      </form>
      {status === "error" && <p className="text-sm text-red-500">{message}</p>}
      <p className="text-xs text-gray-400">
        Use the email you subscribe with. Not subscribed yet?{" "}
        <Link href="/join" className="text-green-700 font-semibold hover:underline">
          Join free
        </Link>{" "}
        and start earning.
      </p>
    </div>
  );
}
