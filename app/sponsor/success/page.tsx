"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";
import { workspaceFetch } from "@/lib/workspace-client";

interface Status {
  found: boolean;
  paid?: boolean;
  businessName?: string;
  tierLabel?: string;
  weekLabel?: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let attempts = 0;
    const check = async () => {
      attempts++;
      try {
        const res = await workspaceFetch(`/api/sponsor/week-bookings/by-session?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (data.found && data.paid) {
          setStatus(data);
          return;
        }
        setStatus(data);
      } catch {
        /* retry */
      }
      if (attempts < 6) setTimeout(check, 3000);
    };
    check();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
        <div className="flex items-center justify-center mb-5">
          <Logo className="h-12 w-auto" />
        </div>
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re booked!</h1>
        {status?.paid ? (
          <p className="text-gray-600 text-sm mb-6">
            {status.businessName} is confirmed as a <span className="font-semibold">{status.tierLabel}</span> for the week of{" "}
            <span className="font-semibold">{status.weekLabel}</span>.
          </p>
        ) : (
          <p className="text-gray-600 text-sm mb-6">
            Payment received. We&apos;re confirming your booking now.
          </p>
        )}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left text-sm text-gray-600 space-y-2">
          <p><span className="font-semibold text-gray-900">What happens next:</span></p>
          <p>1. A confirmation email is on its way to you.</p>
          <p>2. Chad writes your ad copy (or yours goes live as-is).</p>
          <p>3. Your ad runs in every issue that week, Monday to Friday.</p>
          <p>4. You&apos;ll get a results report the following Monday.</p>
        </div>
        <Link href="/sponsor" className="block w-full bg-green-700 hover:bg-green-800 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
          Back to Sponsorships
        </Link>
      </div>
    </div>
  );
}

export default function SponsorSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-sm text-gray-500">Loading…</p></div>}>
      <SuccessContent />
    </Suspense>
  );
}
