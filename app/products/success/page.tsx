"use client";

import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";

export default function ProductSuccessPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900">Order confirmed</h1>
        <p className="text-gray-500 mt-3">
          Thanks for supporting The Gist. Stripe just emailed your receipt.
          If your product has a fulfillment note (like a pre-order print run), watch your inbox for updates from us.
        </p>
        <Link href="/products" className="inline-block mt-6 px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800">
          Keep browsing
        </Link>
      </div>
      </div>
    </main>
  );
}
