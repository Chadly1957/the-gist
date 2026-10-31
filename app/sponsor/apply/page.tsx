"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WeekBookingFlow, { WeekTier } from "@/components/sponsor/WeekBookingFlow";
import SiteHeader from "@/components/SiteHeader";

function ApplyContent() {
  const searchParams = useSearchParams();
  // The weekly Presenting Sponsor tier is retired: every paid booking is
  // the 7-Issue Featured Campaign now. Old ?tier=presenting links land here
  // too and simply book the campaign.
  const cancelled = searchParams.get("cancelled") === "1";
  const rebookToken = searchParams.get("rebook");
  const initialMarket = searchParams.get("market") === "both" ? "both" : undefined;

  return (
    <WeekBookingFlow
      tier="standard"
      cancelled={cancelled}
      rebookToken={rebookToken}
      backHref="/sponsor"
      initialMarket={initialMarket}
    />
  );
}

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-sm text-gray-500">Loading…</p></div>}>
        <ApplyContent />
      </Suspense>
    </div>
  );
}
