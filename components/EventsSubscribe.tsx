"use client";
import { workspaceFetch } from "@/lib/workspace-client";

import { useState } from "react";

// Compact signup form for the public events calendar: the same
// /api/subscribe flow as the homepage form, tagged so signups from this
// page are attributable (utm_source=events).
export default function EventsSubscribe() {
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({
          email,
          utmSource: "events",
          utmMedium: "web",
          utmCampaign: "events-page",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <p className="text-sm font-semibold text-green-800">
        You&apos;re in! Watch your inbox for a welcome email.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email address"
          className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          {status === "loading" ? "Joining…" : "Subscribe free"}
        </button>
      </div>
      {status === "error" && message && (
        <p className="text-xs text-red-500 mt-2">{message}</p>
      )}
    </form>
  );
}
