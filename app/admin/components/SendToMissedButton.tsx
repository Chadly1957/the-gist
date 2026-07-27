"use client";

import { useState } from "react";

export function SendToMissedButton({
  sendId,
  missedCount,
}: {
  sendId: string;
  missedCount: number;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [sent, setSent] = useState(0);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!confirm(`Send to ${missedCount} missed subscriber${missedCount === 1 ? "" : "s"}?`)) return;
    setState("loading");
    try {
      const res = await fetch(`/api/admin/newsletter/send-missed/${sendId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSent(data.sent ?? missedCount);
        setState("done");
      } else {
        setError(data.error || "Send failed");
        setState("error");
      }
    } catch (e) {
      setError(String(e));
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Sent to {sent.toLocaleString()}
      </span>
    );
  }

  if (state === "error") {
    return <span className="text-xs text-red-500">{error}</span>;
  }

  return (
    <button
      onClick={handleSend}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full transition-colors disabled:opacity-60"
    >
      {state === "loading" ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Sending…
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {missedCount.toLocaleString()} missed — send now
        </>
      )}
    </button>
  );
}
