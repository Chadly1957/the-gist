"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import UrlInput from "@/components/UrlInput";
import { normalizeUrl } from "@/lib/url";

type Step = "apply" | "listing" | "booking" | "done";
type Tier = "spotlight" | "in_article" | "presenting" | "wordy";

const TIER_META: Record<Tier, { label: string; step2Heading: string; step2Sub: string }> = {
  spotlight: {
    label: "Community Partners",
    step2Heading: "Set up your free listing",
    step2Sub: "This is how you'll appear in every newsletter. Takes 2 minutes.",
  },
  in_article: {
    label: "Standard Sponsorship",
    step2Heading: "Reserve your ad dates",
    step2Sub: "Enter your ad details and pick your date. We'll confirm within 1–2 business days.",
  },
  presenting: {
    label: "Presenting Sponsor",
    step2Heading: "Reserve your presenting dates",
    step2Sub: "Enter your ad details and pick your date. We'll confirm within 1–2 business days.",
  },
  wordy: {
    label: "Decatur Wordy Sponsor",
    step2Heading: "Reserve your Wordy date",
    step2Sub: "Pick your preferred date and enter your ad details. We'll confirm availability within 24 hours.",
  },
};

function ApplyContent() {
  const searchParams = useSearchParams();
  const tierParam = searchParams.get("tier");
  const tier: Tier = tierParam && tierParam in TIER_META ? (tierParam as Tier) : "spotlight";
  const meta = TIER_META[tier];

  const [step, setStep] = useState<Step>("apply");
  const [token, setToken] = useState("");
  const [portalUrl, setPortalUrl] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [listingCreated, setListingCreated] = useState(false);

  // Step 1 — apply
  const [form, setForm] = useState({ businessName: "", contactName: "", email: "", phone: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  // Step 2a — listing (spotlight)
  const [lForm, setLForm] = useState({ businessName: "", description: "", ctaUrl: "", ctaLabel: "Visit Website", logoUrl: "" });
  const [lSubmitting, setLSubmitting] = useState(false);
  const [lError, setLError] = useState("");

  // Step 2b — booking (in_article / presenting / wordy)
  const [bDate, setBDate] = useState("");
  const [bForm, setBForm] = useState({
    type: "in_article" as "in_article" | "presenting",
    headline: "",
    body: "",
    ctaUrl: "",
    ctaLabel: "Learn More",
    imageUrl: "",
    presentingBlurb: "",
  });
  const [bSubmitting, setBSubmitting] = useState(false);
  const [bError, setBError] = useState("");

  function update(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleResend() {
    if (!resendEmail.trim()) return;
    setResendSubmitting(true);
    setResendMessage("");
    try {
      const res = await fetch("/api/sponsor/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json();
      setResendMessage(res.ok ? data.message : data.error || "Something went wrong.");
    } catch {
      setResendMessage("Connection error. Please try again.");
    } finally {
      setResendSubmitting(false);
    }
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setApplyError("");
    try {
      const res = await fetch("/api/sponsor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website: normalizeUrl(form.website) }),
      });
      const data = await res.json();
      if (!res.ok) { setApplyError(data.error || "Something went wrong."); return; }

      const url: string = data.portalUrl;
      setPortalUrl(url);
      const match = url.match(/token=([^&]+)/);
      const t = match ? match[1] : "";
      setToken(t);

      if (tier === "spotlight") {
        setLForm({
          businessName: form.businessName,
          description: "",
          ctaUrl: normalizeUrl(form.website),
          ctaLabel: "Visit Website",
          logoUrl: "",
        });
        setStep("listing");
      } else {
        setBForm({
          type: tier === "presenting" ? "presenting" : "in_article",
          headline: `Visit ${form.businessName}`,
          body: "",
          ctaUrl: normalizeUrl(form.website),
          ctaLabel: "Learn More",
          imageUrl: "",
          presentingBlurb: tier === "presenting" ? `Today's Gist is brought to you by ${form.businessName}.` : "",
        });
        setBDate("");
        setStep("booking");
      }
    } catch {
      setApplyError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitListing(e: React.FormEvent) {
    e.preventDefault();
    setLSubmitting(true);
    setLError("");
    try {
      const res = await fetch("/api/sponsor/spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...lForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setListingCreated(true);
        setDoneMessage("Your listing has been submitted for review — we'll approve it within 1–2 business days.");
        setStep("done");
      } else {
        setLError(data.error || "Submission failed.");
      }
    } catch {
      setLError("Connection error.");
    } finally {
      setLSubmitting(false);
    }
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bDate) { setBError("Please select a date."); return; }
    setBSubmitting(true);
    setBError("");
    const endpoint = tier === "wordy" ? "/api/sponsor/wordy-booking" : "/api/sponsor/booking";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, date: bDate, ...bForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setDoneMessage(
          tier === "wordy"
            ? "Your Wordy sponsorship request is in — we'll reach out within 24 hours to confirm your date and collect payment."
            : "Your booking request has been submitted — we'll confirm within 1–2 business days and collect payment then."
        );
        setStep("done");
      } else {
        setBError(data.error || "Submission failed.");
      }
    } catch {
      setBError("Connection error.");
    } finally {
      setBSubmitting(false);
    }
  }

  const todayStr = new Date().toLocaleDateString("en-CA");

  // ── DONE ──
  if (step === "done") {
    const calloutSuffix = listingCreated ? "&callout=booking" : "";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re all set!</h2>
          {doneMessage && <p className="text-gray-600 text-sm mb-3">{doneMessage}</p>}
          <p className="text-gray-400 text-sm mb-6">
            Your sponsor portal is ready — bookmark it to manage your sponsorship, check status, and book more dates.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Your Portal Link</p>
            <p className="text-sm break-all text-green-700 font-medium">{portalUrl}</p>
          </div>
          <a
            href={`${portalUrl}${calloutSuffix}`}
            className="block w-full bg-green-700 hover:bg-green-800 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            Go to My Sponsor Portal →
          </a>
          <p className="text-xs text-gray-400 mt-4">We also emailed this link to you. Save it — you&apos;ll need it to manage your sponsorship.</p>
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

        {/* Step progress bar */}
        <div className="flex items-center gap-1.5 mb-6">
          <div className="h-1.5 rounded-full flex-1 bg-green-600" />
          <div className={`h-1.5 rounded-full flex-1 ${step !== "apply" ? "bg-green-600" : "bg-gray-200"}`} />
        </div>

        {/* ── STEP 1: APPLY ── */}
        {step === "apply" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {tier === "spotlight" ? "Apply for Free" : "Reserve Dates"}
            </h1>
            <p className="text-sm text-gray-500 mb-0.5">
              {tier === "spotlight"
                ? "Tell us about your business and we'll get your free Community Partners listing set up."
                : `Create your sponsor profile, then we'll set up your ${meta.label} right away.`}
            </p>
            <p className="text-xs text-green-600 font-medium mb-6">Step 1 of 2 — Your Info</p>

            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name *</label>
                <input type="text" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} required placeholder="Decatur Coffee Co."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Your Name *</label>
                <input type="text" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} required placeholder="Jane Smith"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address *</label>
                <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required placeholder="jane@decaturcoffee.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="256-555-0100"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Website</label>
                  <input type="text" value={form.website} onChange={(e) => update("website", e.target.value)} onBlur={(e) => update("website", normalizeUrl(e.target.value))} placeholder="decaturcoffee.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              {applyError && <p className="text-sm text-red-600">{applyError}</p>}
              <button type="submit" disabled={submitting}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                {submitting ? "Setting up your account…" : "Continue →"}
              </button>
            </form>

            <div className="mt-5 text-center">
              <button type="button" onClick={() => { setShowResend((v) => !v); setResendMessage(""); }}
                className="text-xs text-gray-400 hover:text-gray-600">
                Already applied? Resend my portal link
              </button>
            </div>
            {showResend && (
              <div className="mt-3 flex gap-2">
                <input type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleResend(); } }}
                  placeholder="you@business.com"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button type="button" onClick={handleResend} disabled={resendSubmitting}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap">
                  {resendSubmitting ? "Sending…" : "Send Link"}
                </button>
              </div>
            )}
            {resendMessage && <p className="text-xs text-gray-500 mt-2 text-center">{resendMessage}</p>}
          </>
        )}

        {/* ── STEP 2a: LISTING ── */}
        {step === "listing" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{meta.step2Heading}</h1>
            <p className="text-sm text-gray-500 mb-0.5">{meta.step2Sub}</p>
            <p className="text-xs text-green-600 font-medium mb-6">Step 2 of 2 — Community Partners Listing</p>

            <form onSubmit={submitListing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name *</label>
                <input type="text" value={lForm.businessName} onChange={(e) => setLForm((f) => ({ ...f, businessName: e.target.value }))} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  About Your Business * <span className="font-normal text-gray-400">({lForm.description.length}/300)</span>
                </label>
                <textarea value={lForm.description} onChange={(e) => setLForm((f) => ({ ...f, description: e.target.value }))} required rows={3} maxLength={300}
                  placeholder="1–2 sentences about what you offer and why Decatur readers should visit."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Button Label</label>
                  <input type="text" value={lForm.ctaLabel} onChange={(e) => setLForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Website / Link *</label>
                  <UrlInput value={lForm.ctaUrl} onChange={(v) => setLForm((f) => ({ ...f, ctaUrl: v }))} required placeholder="https://"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              {lError && <p className="text-sm text-red-600">{lError}</p>}
              <button type="submit" disabled={lSubmitting}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                {lSubmitting ? "Submitting…" : "Submit Listing for Review"}
              </button>
              <button type="button" onClick={() => { setStep("done"); setDoneMessage(""); }}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">
                Skip for now — I&apos;ll do this from my portal
              </button>
            </form>
          </>
        )}

        {/* ── STEP 2b: BOOKING ── */}
        {step === "booking" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{meta.step2Heading}</h1>
            <p className="text-sm text-gray-500 mb-0.5">{meta.step2Sub}</p>
            <p className="text-xs text-green-600 font-medium mb-6">Step 2 of 2 — {meta.label}</p>

            <form onSubmit={submitBooking} className="space-y-4">
              {/* Ad type switcher for newsletter ads (not wordy) */}
              {tier !== "wordy" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Ad Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["in_article", "presenting"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setBForm((f) => ({ ...f, type: t }))}
                        className={`p-3 rounded-xl border text-left transition-colors ${bForm.type === t ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <p className="text-xs font-semibold text-gray-800">{t === "in_article" ? "Standard" : "Presenting"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t === "in_article" ? "$15/day" : "$25/day"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {tier === "wordy" ? "Preferred Date *" : "Newsletter Date *"}
                </label>
                <input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} required min={todayStr}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                {tier === "wordy" && (
                  <p className="text-xs text-gray-400 mt-1">We&apos;ll confirm availability and follow up within 24 hours.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Headline *</label>
                <input type="text" value={bForm.headline} onChange={(e) => setBForm((f) => ({ ...f, headline: e.target.value }))} required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Body Copy * <span className="font-normal text-gray-400">({bForm.body.length}/400)</span>
                </label>
                <textarea value={bForm.body} onChange={(e) => setBForm((f) => ({ ...f, body: e.target.value }))} required rows={3} maxLength={400}
                  placeholder="Tell readers what you offer and why they should click."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Label</label>
                  <input type="text" value={bForm.ctaLabel} onChange={(e) => setBForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Link *</label>
                  <UrlInput value={bForm.ctaUrl} onChange={(v) => setBForm((f) => ({ ...f, ctaUrl: v }))} required placeholder="https://"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              {bForm.type === "presenting" && tier !== "wordy" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Custom Intro Blurb <span className="font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea value={bForm.presentingBlurb} onChange={(e) => setBForm((f) => ({ ...f, presentingBlurb: e.target.value }))} rows={2}
                    placeholder={`"Today's Gist is brought to you by ${form.businessName}."`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>
              )}

              {bError && <p className="text-sm text-red-600">{bError}</p>}

              <button type="submit" disabled={bSubmitting}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                {bSubmitting ? "Submitting…" : tier === "wordy" ? "Submit Wordy Request" : "Submit Booking Request"}
              </button>
              <button type="button" onClick={() => { setStep("done"); setDoneMessage(""); }}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">
                Skip for now — I&apos;ll do this from my portal
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function SponsorApplyPage() {
  return (
    <Suspense>
      <ApplyContent />
    </Suspense>
  );
}
