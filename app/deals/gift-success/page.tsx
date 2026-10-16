"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function GiftSuccessInner() {
  const searchParams = useSearchParams();
  const to = searchParams.get("to");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <div className="text-5xl mb-4">🎁</div>
        <h1 className="text-2xl font-bold mb-2">Gift sent!</h1>
        <p className="text-gray-600 text-sm">
          Your payment went through{to ? (
            <> and we&apos;ve emailed the Gist Deals Book to <strong>{to}</strong></>
          ) : (
            <> and the Gist Deals Book is on its way to them</>
          )}. (Tell them to check spam if they don&apos;t see it in a minute or two.)
        </p>
        <p className="text-gray-400 text-xs mt-4">
          Your receipt was emailed to you by our payment processor.
        </p>
        <Link href="/deals" className="inline-block mt-6 text-sm text-green-700 underline">
          Back to Gist Deals
        </Link>
      </div>
    </div>
  );
}

export default function GiftSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading…</p></div>}>
      <GiftSuccessInner />
    </Suspense>
  );
}
