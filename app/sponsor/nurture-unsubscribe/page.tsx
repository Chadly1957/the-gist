"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function unsubscribe() {
    setState("busy");
    try {
      const res = await fetch("/api/sponsor/nurture-unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setState("done");
      setMessage(`${data.businessName} won't receive business tips emails anymore. Your free directory listing stays live.`);
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 max-w-md w-full text-center">
      <div className="flex justify-center mb-5">
        <Logo className="h-12 w-auto" />
      </div>
      {state === "done" ? (
        <>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re unsubscribed</h1>
          <p className="text-sm text-gray-500">{message}</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unsubscribe from business tips?</h1>
          <p className="text-sm text-gray-500 mb-6">
            These are the occasional emails we send listed businesses about getting more from their free listing.
            Your listing and your sponsor portal are not affected.
          </p>
          {state === "error" && <p className="text-sm text-red-600 mb-4">{message}</p>}
          <button
            onClick={unsubscribe}
            disabled={state === "busy" || !token}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {state === "busy" ? "Unsubscribing…" : "Yes, unsubscribe me"}
          </button>
        </>
      )}
    </div>
  );
}

export default function NurtureUnsubscribePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-10 sm:pt-16">
      <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
        <UnsubscribeContent />
      </Suspense>
    </div>
  );
}
