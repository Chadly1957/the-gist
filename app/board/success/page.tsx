"use client";

import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";

export default function BoardSuccessPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">📌</div>
          <h1 className="text-2xl font-bold text-gray-900">Post received</h1>
          <p className="text-gray-500 mt-3">
            Thanks! Your post is awaiting a quick review. Once approved, it runs for 7 days
            in the newsletter and on the Board page. Your receipt is on its way by email.
          </p>
          <Link href="/board" className="inline-block mt-6 px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800">
            View the Board
          </Link>
        </div>
      </div>
    </div>
  );
}
