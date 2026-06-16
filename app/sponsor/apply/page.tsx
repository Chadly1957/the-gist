"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function SponsorApplyPage() {
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ portalUrl: string; message: string } | null>(null);
  const [error, setError] = useState("");

  function update(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/sponsor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re all set!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your sponsor portal is ready. Bookmark this link, it&apos;s your personal access to submit listings, book ad dates, and check your status.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Your Portal Link</p>
            <p className="text-sm break-all text-green-700 font-medium">{result.portalUrl}</p>
          </div>

          <a
            href={result.portalUrl}
            className="block w-full bg-green-700 hover:bg-green-800 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            Go to My Sponsor Portal
          </a>
          <p className="text-xs text-gray-400 mt-4">
            Save this link, you&apos;ll need it to manage your sponsorship.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-12">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full">
        <Link href="/sponsor" className="text-xs text-gray-400 hover:text-gray-600 mb-6 inline-block">
          ← Sponsorship options
        </Link>

        <div className="flex items-center mb-6">
          <Logo className="h-12 w-auto" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Apply to Sponsor</h1>
        <p className="text-sm text-gray-500 mb-6">
          Fill out your business info and we&apos;ll create your sponsor portal where you can submit listings, book ad dates, and track your campaigns.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name *</label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => update("businessName", e.target.value)}
              required
              placeholder="Decatur Coffee Co."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Your Name *</label>
            <input
              type="text"
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              required
              placeholder="jane@decaturcoffee.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="256-555-0100"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {submitting ? "Creating your portal…" : "Create My Sponsor Portal"}
          </button>
        </form>
      </div>
    </div>
  );
}
