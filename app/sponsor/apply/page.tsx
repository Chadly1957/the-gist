"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/workspace/WorkspaceLink";
import Logo from "@/components/Logo";
import { workspaceFetch } from "@/lib/workspace-client";
import { normalizeUrl } from "@/lib/url";

type Step = "week" | "business";
type Tier = "presenting" | "standard";

interface TierAvailability {
  tier: Tier;
  state: "available" | "one_left" | "sold";
  taken: number;
  slots: number;
}
interface WeekAvailability {
  weekStart: string;
  label: string;
  tiers: TierAvailability[];
}

const TIER_META: Record<Tier, { label: string; price: string; blurb: string }> = {
  presenting: {
    label: "Presenting Sponsor",
    price: "$150/week",
    blurb: "Top of the email. Your logo, a short write-up, and link. Exclusive: only one per week.",
  },
  standard: {
    label: "Standard Sponsor",
    price: "$75/week",
    blurb: "Mid-email placement. Your logo and a short write-up. Two slots per week.",
  },
};

function ApplyContent() {
  const searchParams = useSearchParams();
  const tierParam = searchParams.get("tier");
  const tier: Tier = tierParam === "presenting" ? "presenting" : "standard";
  const cancelled = searchParams.get("cancelled") === "1";
  const rebookParam = searchParams.get("rebook");
  const meta = TIER_META[tier];

  const [step, setStep] = useState<Step>("week");
  const [weeks, setWeeks] = useState<WeekAvailability[]>([]);
  const [weeksLoading, setWeeksLoading] = useState(true);
  const [weeksError, setWeeksError] = useState("");

  // Hold state
  const [holdToken, setHoldToken] = useState("");
  const [heldWeekLabel, setHeldWeekLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [holding, setHolding] = useState(false);
  const [holdError, setHoldError] = useState("");

  // Business form
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    website: "",
    logoUrl: "",
    aboutText: "",
    chadWritesCopy: true,
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [rebooked, setRebooked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function update(key: keyof typeof form, val: string | boolean) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function loadWeeks() {
    setWeeksLoading(true);
    setWeeksError("");
    try {
      const res = await workspaceFetch("/api/sponsor/weeks");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load weeks.");
      setWeeks(data.weeks);
    } catch {
      setWeeksError("Could not load availability. Please refresh and try again.");
    } finally {
      setWeeksLoading(false);
    }
  }

  useEffect(() => {
    loadWeeks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebook prefill
  useEffect(() => {
    if (!rebookParam) return;
    (async () => {
      try {
        const res = await workspaceFetch(`/api/sponsor/week-bookings/by-token?token=${encodeURIComponent(rebookParam)}`);
        const data = await res.json();
        if (res.ok) {
          setForm((f) => ({
            ...f,
            businessName: data.businessName || "",
            contactName: data.contactName || "",
            email: data.email || "",
            website: data.website || "",
            logoUrl: data.logoUrl || "",
            aboutText: data.aboutText || "",
          }));
          setRebooked(true);
        }
      } catch {
        /* ignore invalid token */
      }
    })();
  }, [rebookParam]);

  // Hold countdown
  useEffect(() => {
    if (step !== "business" || !expiresAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(id);
        handleHoldExpired();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, expiresAt]);

  async function handleHoldExpired() {
    if (holdToken) {
      try {
        await workspaceFetch("/api/sponsor/week-holds", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holdToken }),
        });
      } catch {
        /* best effort */
      }
    }
    setHoldToken("");
    setStep("week");
    setHoldError("Your 10-minute reservation expired. Please pick a week again.");
    loadWeeks();
  }

  async function pickWeek(week: WeekAvailability) {
    setHolding(true);
    setHoldError("");
    try {
      const res = await workspaceFetch("/api/sponsor/week-holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, weekStart: week.weekStart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reserve that week.");
      setHoldToken(data.holdToken);
      setHeldWeekLabel(week.label);
      setExpiresAt(new Date(data.expiresAt).getTime());
      setSecondsLeft(Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
      setStep("business");
      window.scrollTo(0, 0);
    } catch (e) {
      setHoldError(e instanceof Error ? e.message : "Could not reserve that week.");
      loadWeeks();
    } finally {
      setHolding(false);
    }
  }

  function backToWeeks() {
    handleHoldExpired();
  }

  async function handleLogoUpload(file: File) {
    setUploading(true);
    setFormError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("holdToken", holdToken);
    try {
      const res = await workspaceFetch("/api/sponsor/week-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        update("logoUrl", data.url);
      } else {
        setFormError(data.error || "Logo upload failed.");
      }
    } catch {
      setFormError("Logo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const res = await workspaceFetch("/api/sponsor/week-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdToken,
          businessName: form.businessName,
          contactName: form.contactName,
          email: form.email,
          website: form.website ? normalizeUrl(form.website) : "",
          logoUrl: form.logoUrl,
          aboutText: form.aboutText,
          chadWritesCopy: form.chadWritesCopy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Checkout failed. Please try again.");
      setSubmitting(false);
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

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
          <div className={`h-1.5 rounded-full flex-1 ${step === "business" ? "bg-green-600" : "bg-gray-200"}`} />
          <div className="h-1.5 rounded-full flex-1 bg-gray-200" />
        </div>

        {cancelled && step === "week" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-800">
            Your payment was cancelled (no charge was made). Pick a week to try again.
          </div>
        )}

        {/* ── STEP 1: PICK A WEEK ── */}
        {step === "week" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{meta.label}</h1>
            <p className="text-sm text-gray-500 mb-0.5">{meta.blurb}</p>
            <p className="text-xs text-green-600 font-medium mb-1">Step 1 of 3: Pick your week</p>
            <p className="text-sm font-semibold text-gray-900 mb-4">{meta.price} · runs Monday to Friday</p>

            {weeksLoading && <p className="text-sm text-gray-500 py-8 text-center">Loading weeks…</p>}
            {weeksError && <p className="text-sm text-red-600 py-4">{weeksError}</p>}

            {!weeksLoading && !weeksError && (
              <div className="space-y-2">
                {weeks.map((week) => {
                  const t = week.tiers.find((x) => x.tier === tier)!;
                  const sold = t.state === "sold";
                  return (
                    <button
                      key={week.weekStart}
                      type="button"
                      disabled={sold || holding}
                      onClick={() => pickWeek(week)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                        sold
                          ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                          : "border-gray-200 hover:border-green-500 hover:bg-green-50"
                      }`}
                    >
                      <span className="text-sm font-semibold text-gray-900">{week.label}</span>
                      {sold ? (
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Sold</span>
                      ) : t.state === "one_left" ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                          1 slot left
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                          Available
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {holdError && <p className="text-sm text-red-600 mt-4">{holdError}</p>}
            <p className="text-xs text-gray-400 mt-5 text-center">
              Picking a week reserves your slot for 10 minutes while you tell us about your business.
            </p>
          </>
        )}

        {/* ── STEP 2: ABOUT THE BUSINESS ── */}
        {step === "business" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">About your business</h1>
            <p className="text-sm text-gray-500 mb-0.5">
              {meta.label} · {heldWeekLabel} · {meta.price}
            </p>
            <p className="text-xs text-green-600 font-medium mb-1">Step 2 of 3 — Your info</p>
            <p className={`text-xs font-semibold mb-5 ${secondsLeft < 120 ? "text-red-600" : "text-gray-500"}`}>
              ⏱ Your slot is reserved for {mm}:{ss}
            </p>
            {rebooked && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-5 text-sm text-green-800">
                Welcome back! We pre-filled your details from last time — just confirm them and check out.
              </div>
            )}

            <form onSubmit={handleCheckout} className="space-y-4">
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Website <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.website} onChange={(e) => update("website", e.target.value)} onBlur={(e) => update("website", normalizeUrl(e.target.value))} placeholder="decaturcoffee.com"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Logo *</label>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                {form.logoUrl ? (
                  <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.logoUrl} alt="Logo preview" className="h-12 w-12 object-contain rounded-lg bg-gray-50" />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="text-xs text-green-700 font-semibold hover:underline">
                      {uploading ? "Uploading…" : "Replace logo"}
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 text-sm text-gray-500 hover:border-green-500 hover:text-green-700 transition-colors">
                    {uploading ? "Uploading…" : "Upload your logo (PNG or JPG, under 5MB)"}
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  What should readers know about your business? *
                </label>
                <textarea value={form.aboutText} onChange={(e) => update("aboutText", e.target.value)} required rows={4}
                  placeholder="Family-owned coffee shop downtown since 2012. Fresh-roasted beans, homemade pastries, and the friendliest baristas in Decatur."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <label className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl p-3 cursor-pointer">
                <input type="checkbox" checked={form.chadWritesCopy} onChange={(e) => update("chadWritesCopy", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-green-700" />
                <span className="text-sm text-gray-700">
                  <span className="font-semibold">Have Chad write my ad for free</span>
                  <span className="text-green-700 font-medium"> (recommended)</span>
                  <br />
                  <span className="text-xs text-gray-500">He&apos;ll turn your description above into ad copy that fits the newsletter.</span>
                </span>
              </label>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <button type="submit" disabled={submitting || uploading || !form.logoUrl}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                {submitting ? "Starting secure checkout…" : `Continue to payment — ${meta.price}`}
              </button>
              <button type="button" onClick={backToWeeks} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                ← Pick a different week
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-sm text-gray-500">Loading…</p></div>}>
      <ApplyContent />
    </Suspense>
  );
}
