"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function OptOutInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    fetch("/api/coupons/digest-optout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => setStatus(r.ok ? "done" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        {status === "working" && <p className="text-gray-600">Updating your preferences…</p>}
        {status === "done" && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re unsubscribed</h1>
            <p className="text-gray-600 text-sm">
              You won&apos;t get the weekly deals email anymore. Your coupon book still works —
              your personal link is unchanged.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Hmm, that didn&apos;t work</h1>
            <p className="text-gray-600 text-sm">
              This link looks invalid or expired. Reply to any Gist email and we&apos;ll sort it out.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DigestOptOutPage() {
  return (
    <Suspense>
      <OptOutInner />
    </Suspense>
  );
}
