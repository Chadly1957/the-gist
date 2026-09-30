"use client";

import { useState, useRef, Suspense } from "react";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { workspaceFetch } from "@/lib/workspace-client";
import { normalizeUrl } from "@/lib/url";

const MAX_DESC = 140;

function CommunityContent() {
  const { workspace } = useWorkspace();
  const [form, setForm] = useState({ businessName: "", contactName: "", email: "", website: "", description: "", subscribeNewsletter: false });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [portalUrl, setPortalUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function update(key: keyof typeof form, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await workspaceFetch("/api/sponsor/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website: normalizeUrl(form.website) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      // Optional logo upload, then attach it to the listing.
      if (logoFile) {
        try {
          const fd = new FormData();
          fd.append("file", logoFile);
          fd.append("token", data.token);
          const upRes = await workspaceFetch("/api/sponsor/upload", { method: "POST", body: fd });
          const upData = await upRes.json();
          if (upRes.ok && upData.url) {
            await workspaceFetch("/api/sponsor/spotlight", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: data.token,
                id: data.listingId,
                businessName: form.businessName,
                description: form.description,
                ctaUrl: normalizeUrl(form.website),
                logoUrl: upData.url,
              }),
            });
          }
        } catch {
          /* listing is live either way; logo can be added from the portal */
        }
      }

      setPortalUrl(data.portalUrl);
      setDone(true);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re on the Community Board!</h2>
          <p className="text-gray-600 text-sm mb-6">
            Your listing is live now and will start rotating at the bottom of the newsletter.
            We also emailed you your portal link.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Your Portal Link</p>
            <p className="text-sm break-all text-green-700 font-medium">{portalUrl}</p>
          </div>
          <WorkspaceAnchor
            href={portalUrl}
            className="block w-full bg-green-700 hover:bg-green-800 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            Go to My Sponsor Portal →
          </WorkspaceAnchor>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-6 sm:pt-12">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-8 max-w-md w-full">
        <Link href="/sponsor" className="text-xs text-gray-400 hover:text-gray-600 mb-5 inline-block">
          ← Sponsorship options
        </Link>
        <div className="flex items-center mb-5">
          <Logo className="h-12 w-auto" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Join the Community Board</h1>
        <p className="text-sm text-gray-500 mb-6">
          Free forever. Your business rotates at the bottom of every newsletter. Takes about a minute.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name *</label>
            <input type="text" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} required placeholder="Decatur Coffee Co."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Your Name *</label>
              <input type="text" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} required placeholder="Jane Smith"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required placeholder="jane@decaturcoffee.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Website or Link *</label>
            <input type="text" value={form.website} onChange={(e) => update("website", e.target.value)} onBlur={(e) => update("website", normalizeUrl(e.target.value))} required placeholder="decaturcoffee.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-600">One-line description *</label>
              <span className={`text-xs ${form.description.length > MAX_DESC ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                {form.description.length}/{MAX_DESC}
              </span>
            </div>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} required rows={2} maxLength={MAX_DESC + 20}
              placeholder="Family-owned coffee shop downtown since 2012."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Logo <span className="text-gray-400 font-normal">(optional, but strongly recommended)</span></label>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            {logoFile ? (
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-3">
                <span className="text-sm text-gray-700 truncate flex-1">{logoFile.name}</span>
                <button type="button" onClick={() => { setLogoFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  className="text-xs text-gray-400 hover:text-gray-600">Remove</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-sm text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
                Upload your logo (PNG or JPG, under 5MB)
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <label className="flex items-start gap-2.5 rounded-xl p-1 cursor-pointer">
            <input type="checkbox" checked={form.subscribeNewsletter} onChange={(e) => update("subscribeNewsletter", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-green-700" />
            <span className="text-sm text-gray-700">
              <span className="font-semibold">Send me {workspace.name} free every morning</span>
              <br />
              <span className="text-xs text-gray-500">Optional. One short email every morning, unsubscribe anytime.</span>
            </span>
          </label>

          <button type="submit" disabled={submitting}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
            {submitting ? "Putting you on the board…" : "Join the Community Board (Free)"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-sm text-gray-500">Loading…</p></div>}>
      <CommunityContent />
    </Suspense>
  );
}
