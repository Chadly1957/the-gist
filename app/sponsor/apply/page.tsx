"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WeekBookingFlow, { WeekTier } from "@/components/sponsor/WeekBookingFlow";

function ApplyContent() {
  const searchParams = useSearchParams();
  const tierParam = searchParams.get("tier");
  const tier: WeekTier = tierParam === "presenting" ? "presenting" : "standard";
  const cancelled = searchParams.get("cancelled") === "1";
  const rebookToken = searchParams.get("rebook");

  return (
    <WeekBookingFlow
      tier={tier}
      cancelled={cancelled}
      rebookToken={rebookToken}
      backHref="/sponsor"
    />
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-sm text-gray-500">Loading…</p></div>}>
      <ApplyContent />
    </Suspense>
  );
}
