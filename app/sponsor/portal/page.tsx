"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Spotlight {
  id: string;
  businessName: string;
  logoUrl: string | null;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  status: string;
  createdAt: string;
}

interface Booking {
  id: string;
  type: string;
  date: string;
  status: string;
  isPaid: boolean;
  headline: string;
  body: string;
  ctaUrl: string;
  imageUrl: string | null;
  presentingBlurb: string | null;
}

interface Profile {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  website: string | null;
  spotlights: Spotlight[];
  bookings: Booking[];
}

type View = "overview" | "spotlight" | "booking";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "bg-yellow-50 text-yellow-700" },
  approved: { label: "Approved", color: "bg-green-50 text-green-700" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500" },
  pending_review: { label: "Pending Review", color: "bg-yellow-50 text-yellow-700" },
  rejected: { label: "Not Approved", color: "bg-red-50 text-red-600" },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-500" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: "bg-gray-100 text-gray-500" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>;
}

function PortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("overview");

  // Spotlight form
  const [sForm, setSForm] = useState({ businessName: "", logoUrl: "", description: "", ctaLabel: "Visit Website", ctaUrl: "" });
  const [sUploading, setSUploading] = useState(false);
  const [sSubmitting, setSSubmitting] = useState(false);
  const [sError, setSError] = useState("");
  const [sSuccess, setSSuccess] = useState(false);
  const sFileRef = useRef<HTMLInputElement>(null);

  // Booking form
  const [bType, setBType] = useState<"in_article" | "presenting">("in_article");
  const [bDate, setBDate] = useState("");
  const [bForm, setBForm] = useState({ headline: "", body: "", ctaUrl: "", ctaLabel: "Learn More", imageUrl: "", presentingBlurb: "" });
  const [bUploading, setBUploading] = useState(false);
  const [bSubmitting, setBSubmitting] = useState(false);
  const [bError, setBError] = useState("");
  const [bSuccess, setBSuccess] = useState(false);
  const bFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setError("No portal link provided."); setLoading(false); return; }
    fetch(`/api/sponsor/portal?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); }
        else { setProfile(data.profile); setSForm((f) => ({ ...f, businessName: data.profile.businessName })); }
      })
      .catch(() => setError("Failed to load. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleImageUpload(
    file: File,
    setUploading: (v: boolean) => void,
    onSuccess: (url: string) => void,
    setError: (e: string) => void
  ) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);
    try {
      const res = await fetch("/api/sponsor/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) onSuccess(data.url);
      else setError(data.error || "Upload failed.");
    } catch { setError("Upload failed."); }
    finally { setUploading(false); }
  }

  async function submitSpotlight(e: React.FormEvent) {
    e.preventDefault();
    setSSubmitting(true); setSError("");
    try {
      const res = await fetch("/api/sponsor/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...sForm }),
      });
      const data = await res.json();
      if (res.ok) { setSSuccess(true); setProfile((p) => p ? { ...p, spotlights: [data.listing, ...p.spotlights] } : p); }
      else setSError(data.error || "Submission failed.");
    } catch { setSError("Connection error."); }
    finally { setSSubmitting(false); }
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setBSubmitting(true); setBError("");
    try {
      const res = await fetch("/api/sponsor/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type: bType, date: bDate, ...bForm }),
      });
      const data = await res.json();
      if (res.ok) { setBSuccess(true); setProfile((p) => p ? { ...p, bookings: [...p.bookings, data.booking] } : p); }
      else setBError(data.error || "Submission failed.");
    } catch { setBError("Connection error."); }
    finally { setBSubmitting(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-500 text-sm mb-2">{error}</p>
        <a href="/sponsor/apply" className="text-sm text-green-700 underline">Apply for a new portal</a>
      </div>
    </div>
  );

  if (!profile) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="font-bold text-sm text-gray-800">The Gist Decatur</span>
            <span className="text-gray-300 mx-2">|</span>
            <span className="text-sm text-gray-600">{profile.businessName}</span>
          </div>
          <a href="/sponsor" className="text-xs text-gray-400 hover:text-gray-600">Sponsorship Info</a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Navigation */}
        {view !== "overview" && (
          <button onClick={() => { setView("overview"); setSSuccess(false); setBSuccess(false); }} className="text-sm text-green-700 hover:underline mb-6 inline-block">
            ← Back to overview
          </button>
        )}

        {/* OVERVIEW */}
        {view === "overview" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sponsor Portal</h1>
              <p className="text-gray-500 text-sm mt-1">Welcome back, {profile.contactName}.</p>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setView("spotlight"); setSSuccess(false); }}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Spotlight Listing</p>
                  <p className="text-xs text-gray-400">Submit or view your free listing</p>
                </div>
              </button>
              <button
                onClick={() => { setView("booking"); setBSuccess(false); setBError(""); }}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Book Ad Date</p>
                  <p className="text-xs text-gray-400">In-article or presenting sponsor</p>
                </div>
              </button>
            </div>

            {/* Spotlights */}
            {profile.spotlights.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Spotlight Listings</h2>
                <div className="space-y-2">
                  {profile.spotlights.map((s) => (
                    <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                      {s.logoUrl && <img src={s.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain border border-gray-100" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{s.businessName}</p>
                        <p className="text-xs text-gray-400 truncate">{s.description}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bookings */}
            {profile.bookings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Ad Bookings</h2>
                <div className="space-y-2">
                  {profile.bookings.map((b) => (
                    <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-gray-800">{b.date}</p>
                          <span className="text-xs text-gray-400 capitalize">{b.type === "in_article" ? "In-Article" : "Presenting"}</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{b.headline}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={b.status} />
                        {!b.isPaid && b.status !== "rejected" && (
                          <span className="text-xs text-orange-600 font-medium">Payment pending</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SPOTLIGHT FORM */}
        {view === "spotlight" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Small Business Spotlight</h1>
            <p className="text-sm text-gray-500 mb-6">Free rotating placement in every newsletter. Submit your listing and we&apos;ll review it within 1–2 business days.</p>

            {sSuccess ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                <p className="text-green-800 font-semibold mb-1">Listing submitted!</p>
                <p className="text-sm text-green-600">We&apos;ll review it and reach out if we have any questions.</p>
                <button onClick={() => { setSSuccess(false); setView("overview"); }} className="mt-4 text-sm text-green-700 underline">
                  Back to portal
                </button>
              </div>
            ) : (
              <form onSubmit={submitSpotlight} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name *</label>
                  <input type="text" value={sForm.businessName} onChange={(e) => setSForm((f) => ({ ...f, businessName: e.target.value }))} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Logo</label>
                  <div className="flex gap-2">
                    <input type="url" value={sForm.logoUrl} onChange={(e) => setSForm((f) => ({ ...f, logoUrl: e.target.value }))} placeholder="https://... or upload below"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <input ref={sFileRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, setSUploading, (url) => setSForm((fm) => ({ ...fm, logoUrl: url })), setSError); }} />
                    <label onClick={() => sFileRef.current?.click()}
                      className={`cursor-pointer flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap ${sUploading ? "opacity-60 pointer-events-none" : ""}`}>
                      {sUploading ? "Uploading…" : "Upload"}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">About Your Business * <span className="font-normal text-gray-400">({sForm.description.length}/300)</span></label>
                  <textarea value={sForm.description} onChange={(e) => setSForm((f) => ({ ...f, description: e.target.value }))} required rows={3} maxLength={300}
                    placeholder="1–2 sentences about what you do and why readers should visit."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Button Label</label>
                    <input type="text" value={sForm.ctaLabel} onChange={(e) => setSForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Website / CTA Link *</label>
                    <input type="url" value={sForm.ctaUrl} onChange={(e) => setSForm((f) => ({ ...f, ctaUrl: e.target.value }))} required placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>

                {sError && <p className="text-sm text-red-600">{sError}</p>}

                <button type="submit" disabled={sSubmitting}
                  className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {sSubmitting ? "Submitting…" : "Submit Listing for Review"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* BOOKING FORM */}
        {view === "booking" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Book an Ad Date</h1>
            <p className="text-sm text-gray-500 mb-6">Choose your ad type, pick a date, and fill in your ad content. We&apos;ll review and confirm within 1–2 business days. Payment is collected separately.</p>

            {bSuccess ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                <p className="text-green-800 font-semibold mb-1">Booking submitted!</p>
                <p className="text-sm text-green-600">We&apos;ll review it and reach out to confirm and collect payment.</p>
                <div className="flex gap-3 justify-center mt-4">
                  <button onClick={() => { setBSuccess(false); setBForm({ headline: "", body: "", ctaUrl: "", ctaLabel: "Learn More", imageUrl: "", presentingBlurb: "" }); setBDate(""); }}
                    className="text-sm text-green-700 underline">Book another date</button>
                  <button onClick={() => { setBSuccess(false); setView("overview"); }} className="text-sm text-gray-500 underline">Back to portal</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitBooking} className="space-y-5 bg-white rounded-xl border border-gray-200 p-6">
                {/* Type selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Ad Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["in_article", "presenting"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setBType(t)}
                        className={`p-3 rounded-xl border text-left transition-colors ${bType === t ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <p className="text-sm font-semibold text-gray-800">{t === "in_article" ? "In-Article — $15/day" : "Presenting Sponsor — $25/day"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t === "in_article" ? "Mixed in with news articles" : "Opening mention + in-article ad"}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Newsletter Date *</label>
                  <input type="date" value={bDate} min={today} onChange={(e) => setBDate(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <p className="text-xs text-gray-400 mt-1">
                    {bType === "in_article" ? "Up to 2 in-article slots per day." : "Only 1 presenting sponsor per day."}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Image</label>
                  <div className="flex gap-2">
                    <input type="url" value={bForm.imageUrl} onChange={(e) => setBForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://... or upload"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <input ref={bFileRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, setBUploading, (url) => setBForm((fm) => ({ ...fm, imageUrl: url })), setBError); }} />
                    <label onClick={() => bFileRef.current?.click()}
                      className={`cursor-pointer flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap ${bUploading ? "opacity-60 pointer-events-none" : ""}`}>
                      {bUploading ? "Uploading…" : "Upload"}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Headline *</label>
                  <input type="text" value={bForm.headline} onChange={(e) => setBForm((f) => ({ ...f, headline: e.target.value }))} required placeholder="Grab readers' attention"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Body Copy * <span className="font-normal text-gray-400">({bForm.body.length}/250)</span></label>
                  <textarea value={bForm.body} onChange={(e) => setBForm((f) => ({ ...f, body: e.target.value }))} required rows={3} maxLength={250}
                    placeholder="Tell readers what you offer and why they should click."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Label</label>
                    <input type="text" value={bForm.ctaLabel} onChange={(e) => setBForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Link *</label>
                    <input type="url" value={bForm.ctaUrl} onChange={(e) => setBForm((f) => ({ ...f, ctaUrl: e.target.value }))} required placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>

                {bType === "presenting" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Custom Intro Blurb <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea value={bForm.presentingBlurb} onChange={(e) => setBForm((f) => ({ ...f, presentingBlurb: e.target.value }))} rows={2}
                      placeholder='e.g. "Today\'s Gist is brought to you by Decatur Coffee Co., your neighborhood spot for great coffee and community." Leave blank to use the default.'
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                  </div>
                )}

                {bError && <p className="text-sm text-red-600">{bError}</p>}

                <button type="submit" disabled={bSubmitting}
                  className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {bSubmitting ? "Submitting…" : "Submit Booking for Review"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SponsorPortalPage() {
  return (
    <Suspense>
      <PortalContent />
    </Suspense>
  );
}
