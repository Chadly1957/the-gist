"use client";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";

import { workspaceFetch } from "@/lib/workspace-client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import SponsorPreview from "@/components/SponsorPreview";
import UrlInput from "@/components/UrlInput";
import WeekBookingFlow, { WeekTier, WeekBookingPrefill } from "@/components/sponsor/WeekBookingFlow";

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

interface WeekBookingStats {
  sends: number;
  opens: number;
  clicks: number;
}

interface WeekBooking {
  id: string;
  tier: WeekTier;
  weekStart: string;
  weekLabel: string;
  status: string;
  amountCents: number;
  paidAt: string | null;
  businessName: string;
  logoUrl: string;
  website: string | null;
  aboutText: string;
  chadWritesCopy: boolean;
  finalAdCopy: string | null;
  creativeLocked: boolean;
  stats: WeekBookingStats;
}

interface Payment {
  id: string;
  paidAt: string;
  weekLabel: string;
  tierLabel: string;
  amountCents: number;
  receiptUrl: string | null;
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

interface Analytics {
  spotlightClicks: number;
  spotlightImpressions: number;
  adClicks: number;
  adImpressions: number;
  bookingClicks: Record<string, number>;
  bookingImpressions: Record<string, number>;
  bookingGameStats: Record<string, { wordyImpressions: number; wordyClicks: number; matchImpressions: number; matchClicks: number }>;
}

type View = "overview" | "spotlight" | "booking" | "profile" | "event" | "billing" | "editWeek";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Review", color: "bg-yellow-50 text-yellow-700" },
  approved: { label: "Approved", color: "bg-green-50 text-green-700" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500" },
  pending_review: { label: "Pending Review", color: "bg-yellow-50 text-yellow-700" },
  pending_payment: { label: "Awaiting Payment", color: "bg-orange-50 text-orange-700" },
  rejected: { label: "Not Approved", color: "bg-red-50 text-red-600" },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-500" },
  paid: { label: "Paid", color: "bg-green-50 text-green-700" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: "bg-gray-100 text-gray-500" };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.color}`}>
      {s.label}
    </span>
  );
}

/** Legacy day-based bookings are read-only history: neutral badges, no dangling actions. */
function LegacyStatusBadge({ status, isPaid }: { status: string; isPaid: boolean }) {
  if (!isPaid) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
        Unpaid (previous system)
      </span>
    );
  }
  const s = STATUS_LABELS[status] || { label: status, color: "bg-gray-100 text-gray-500" };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.color}`}>
      {s.label}
    </span>
  );
}

/** Truncate at a word boundary so blurbs never cut mid-word. */
function truncateWords(s: string, max: number): string {
  if (!s || s.length <= max) return s || "";
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function ctr(clicks: number, impressions: number): string {
  if (impressions <= 0) return "—";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

const BOOK_TIER_META: Record<WeekTier, { label: string; price: string; blurb: string }> = {
  presenting: { label: "Presenting Sponsor", price: "$150/week", blurb: "Top of the email · 1 slot per week" },
  standard: { label: "Standard Sponsor", price: "$75/week", blurb: "Mid-email placement · 2 slots per week" },
};

function PortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [weekBookings, setWeekBookings] = useState<WeekBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("overview");

  // Spotlight form
  const [editingSpotlight, setEditingSpotlight] = useState<Spotlight | null>(null);
  const [sForm, setSForm] = useState({ businessName: "", logoUrl: "", description: "", ctaLabel: "Visit Website", ctaUrl: "" });
  const [sUploading, setSUploading] = useState(false);
  const [sSubmitting, setSSubmitting] = useState(false);
  const [sError, setSError] = useState("");
  const [sSuccess, setSSuccess] = useState(false);
  const [sShowPreview, setSShowPreview] = useState(false);
  const sFileRef = useRef<HTMLInputElement>(null);

  // Profile edit form
  const [pForm, setPForm] = useState({ businessName: "", contactName: "" });
  const [pSaving, setPSaving] = useState(false);
  const [pSaved, setPSaved] = useState(false);
  const [pError, setPError] = useState("");

  // Week booking (new flow)
  const [bookTier, setBookTier] = useState<WeekTier>("standard");
  const [suggestedWeek, setSuggestedWeek] = useState<string | null>(null);
  // Stripe return banners
  const [bookingBanner, setBookingBanner] = useState<"success" | "cancelled" | null>(null);

  // Creative editing for an upcoming week
  const [editingWeek, setEditingWeek] = useState<WeekBooking | null>(null);
  const [wForm, setWForm] = useState({ logoUrl: "", aboutText: "", website: "" });
  const [wUploading, setWUploading] = useState(false);
  const [wSaving, setWSaving] = useState(false);
  const [wError, setWError] = useState("");
  const [wSaved, setWSaved] = useState(false);
  const [wShowPreview, setWShowPreview] = useState(false);
  const wFileRef = useRef<HTMLInputElement>(null);

  // Billing
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");

  // Event form
  const [eForm, setEForm] = useState({ title: "", description: "", eventDate: "", startTime: "", endTime: "", location: "", url: "", cost: "" });
  const [eSubmitting, setESubmitting] = useState(false);
  const [eError, setEError] = useState("");
  const [eSuccess, setESuccess] = useState(false);

  function refreshPortalData() {
    if (!token) return;
    workspaceFetch(`/api/sponsor/portal?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setProfile(data.profile);
          setAnalytics(data.analytics ?? null);
          setWeekBookings(data.weekBookings ?? []);
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!token) { setError("No portal link provided."); setLoading(false); return; }
    workspaceFetch(`/api/sponsor/portal?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); }
        else {
          setProfile(data.profile);
          setAnalytics(data.analytics ?? null);
          setWeekBookings(data.weekBookings ?? []);
          setSForm((f) => ({ ...f, businessName: data.profile.businessName }));
        }
      })
      .catch(() => setError("Failed to load. Please try again."))
      .finally(() => setLoading(false));

    // Renewal deep link: jump straight into booking with the suggested week.
    const bookWeek = searchParams.get("bookWeek");
    if (bookWeek) {
      setSuggestedWeek(bookWeek);
      setView("booking");
    }
    // Stripe return
    const bookingParam = searchParams.get("booking");
    if (bookingParam === "success" || bookingParam === "cancelled") {
      setBookingBanner(bookingParam);
    }
  }, [token, searchParams]);

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
      const res = await workspaceFetch("/api/sponsor/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) onSuccess(data.url);
      else setError(data.error || "Upload failed.");
    } catch (_e) { setError("Upload failed."); }
    finally { setUploading(false); }
  }

  async function submitSpotlight(e: React.FormEvent) {
    e.preventDefault();
    setSSubmitting(true); setSError("");
    try {
      if (editingSpotlight) {
        const res = await workspaceFetch("/api/sponsor/spotlight", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, id: editingSpotlight.id, ...sForm }),
        });
        const data = await res.json();
        if (res.ok) {
          setProfile((p) => p ? { ...p, spotlights: p.spotlights.map((s) => s.id === editingSpotlight.id ? data.listing : s) } : p);
          setEditingSpotlight(null);
          setView("overview");
        } else setSError(data.error || "Update failed.");
      } else {
        const res = await workspaceFetch("/api/sponsor/spotlight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, ...sForm }),
        });
        const data = await res.json();
        if (res.ok) { setSSuccess(true); setProfile((p) => p ? { ...p, spotlights: [data.listing, ...p.spotlights] } : p); }
        else setSError(data.error || "Submission failed.");
      }
    } catch (_e) { setSError("Connection error."); }
    finally { setSSubmitting(false); }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setPSaving(true); setPError(""); setPSaved(false);
    try {
      const res = await workspaceFetch("/api/sponsor/portal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...pForm }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((p) => p ? { ...p, businessName: data.profile.businessName, contactName: data.profile.contactName } : p);
        setPSaved(true);
        setTimeout(() => { setPSaved(false); setView("overview"); }, 1500);
      } else setPError(data.error || "Update failed.");
    } catch (_e) { setPError("Connection error."); }
    finally { setPSaving(false); }
  }

  function openCreativeEditor(wb: WeekBooking) {
    setEditingWeek(wb);
    setWForm({ logoUrl: wb.logoUrl || "", aboutText: wb.aboutText || "", website: wb.website || "" });
    setWError(""); setWSaved(false); setWShowPreview(false);
    setView("editWeek");
  }

  async function saveCreative(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWeek) return;
    setWSaving(true); setWError(""); setWSaved(false);
    try {
      const res = await workspaceFetch("/api/sponsor/portal/week-booking", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          bookingId: editingWeek.id,
          logoUrl: wForm.logoUrl,
          aboutText: wForm.aboutText,
          website: wForm.website,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWSaved(true);
        setWeekBookings((prev) => prev.map((w) => w.id === editingWeek.id ? { ...w, ...data.booking } : w));
        setEditingWeek((prev) => prev ? { ...prev, ...data.booking } : prev);
      } else {
        setWError(data.error || "Could not save changes.");
      }
    } catch (_e) { setWError("Connection error."); }
    finally { setWSaving(false); }
  }

  function openBilling() {
    setView("billing");
    if (payments !== null || billingLoading) return;
    setBillingLoading(true); setBillingError("");
    workspaceFetch(`/api/sponsor/portal/billing?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setBillingError(data.error);
        else setPayments(data.payments ?? []);
      })
      .catch(() => setBillingError("Could not load payment history."))
      .finally(() => setBillingLoading(false));
  }

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    setESubmitting(true); setEError("");
    try {
      const res = await workspaceFetch("/api/sponsor/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...eForm }),
      });
      const data = await res.json();
      if (res.ok) { setESuccess(true); setEForm({ title: "", description: "", eventDate: "", startTime: "", endTime: "", location: "", url: "", cost: "" }); }
      else setEError(data.error || "Submission failed.");
    } catch (_e) { setEError("Connection error."); }
    setESubmitting(false);
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
        <WorkspaceAnchor href="/sponsor/apply" className="text-sm text-green-700 underline">Resend my portal link or apply for a new one</WorkspaceAnchor>
      </div>
    </div>
  );

  if (!profile) return null;

  const prefill: WeekBookingPrefill = {
    businessName: profile.businessName || "",
    contactName: profile.contactName || "",
    email: profile.email || "",
    website: profile.website || "",
    logoUrl: profile.spotlights.find((s) => s.logoUrl)?.logoUrl || "",
    aboutText: profile.spotlights.find((s) => s.description)?.description || "",
  };

  const upcomingWeeks = weekBookings.filter((w) => w.status === "paid" || w.status === "pending_payment");
  const pastWeeks = weekBookings.filter((w) => w.status !== "paid" && w.status !== "pending_payment");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="h-12 w-auto" />
            <span className="text-gray-300 mx-2">|</span>
            <span className="text-sm text-gray-600">{profile.businessName}</span>
          </div>
          <WorkspaceAnchor href="/sponsor" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-600">
            Sponsorship Info ↗
          </WorkspaceAnchor>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Navigation */}
        {view !== "overview" && (
          <button onClick={() => { setView("overview"); setSSuccess(false); setEditingSpotlight(null); setEditingWeek(null); }} className="text-sm text-green-700 hover:underline mb-6 inline-block">
            ← Back to overview
          </button>
        )}

        {/* OVERVIEW */}
        {view === "overview" && (
          <div className="space-y-6">
            {bookingBanner === "success" && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-800">Payment received — week booked!</p>
                  <p className="text-xs text-green-700 mt-0.5">Your sponsorship week is locked in. You&apos;ll see it below.</p>
                </div>
                <button onClick={() => { setBookingBanner(null); refreshPortalData(); }} className="ml-auto text-green-500 hover:text-green-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            {bookingBanner === "cancelled" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Payment cancelled</p>
                  <p className="text-xs text-amber-700 mt-0.5">Your week was not booked. You can try again anytime.</p>
                </div>
                <button onClick={() => setBookingBanner(null)} className="ml-auto text-amber-500 hover:text-amber-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sponsor Portal</h1>
                <p className="text-gray-500 text-sm mt-1">Welcome back, {profile.contactName}.</p>
              </div>
              <button
                onClick={() => { setPForm({ businessName: profile.businessName, contactName: profile.contactName }); setPError(""); setPSaved(false); setView("profile"); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mt-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Profile
              </button>
            </div>

            {/* Analytics summary — only shown once there's data */}
            {analytics && (analytics.spotlightImpressions > 0 || analytics.adImpressions > 0 || analytics.spotlightClicks > 0 || analytics.adClicks > 0) && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-3">Your Performance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(analytics.spotlightImpressions > 0 || analytics.spotlightClicks > 0) && (
                    <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                      <p className="text-2xl font-bold text-green-700">{analytics.spotlightImpressions.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Community Partner impressions</p>
                      {analytics.spotlightClicks > 0 && (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          {analytics.spotlightClicks} clicks
                          {analytics.spotlightImpressions > 0 && ` · ${ctr(analytics.spotlightClicks, analytics.spotlightImpressions)} CTR`}
                        </p>
                      )}
                    </div>
                  )}
                  {(analytics.adImpressions > 0 || analytics.adClicks > 0) && (
                    <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                      <p className="text-2xl font-bold text-green-700">{analytics.adImpressions.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Ad impressions</p>
                      {analytics.adClicks > 0 && (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          {analytics.adClicks} clicks
                          {analytics.adImpressions > 0 && ` · ${ctr(analytics.adClicks, analytics.adImpressions)} CTR`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
                  <p className="text-sm font-semibold text-gray-800">Community Partner Listing</p>
                  <p className="text-xs text-gray-400">Submit or view your free listing</p>
                </div>
              </button>
              <button
                onClick={() => { setSuggestedWeek(null); setView("booking"); }}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Book a Week</p>
                  <p className="text-xs text-gray-400">Presenting $150 · Standard $75</p>
                </div>
              </button>
              <button
                onClick={() => { setView("event"); setESuccess(false); setEError(""); }}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Submit an Event</p>
                  <p className="text-xs text-gray-400">Free — appears in the newsletter calendar</p>
                </div>
              </button>
              <button
                onClick={openBilling}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-sm transition-all text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Payment History</p>
                  <p className="text-xs text-gray-400">Receipts for your sponsorships</p>
                </div>
              </button>
            </div>

            {/* YOUR WEEKS */}
            {weekBookings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Your Weeks</h2>
                <div className="space-y-2">
                  {upcomingWeeks.map((w) => (
                    <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-4">
                        {w.logoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={w.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain border border-gray-100 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-semibold text-gray-800">{w.weekLabel}</p>
                            <span className="text-xs text-gray-400">{w.tier === "presenting" ? "Presenting Sponsor" : "Standard Sponsor"}</span>
                          </div>
                          <p className="text-xs text-gray-400" title={w.aboutText}>{truncateWords(w.aboutText, 90)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <StatusBadge status={w.status} />
                          {w.status === "pending_payment" ? (
                            <span className="text-xs text-gray-400 text-right" title="If checkout wasn't completed, this reservation releases on its own.">
                              Finish checkout in your<br />open tab, or book again.
                            </span>
                          ) : !w.creativeLocked ? (
                            <button onClick={() => openCreativeEditor(w)} className="text-xs text-green-700 hover:underline font-medium">
                              Edit creative
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400" title="Creative locks 24 hours before your week starts">Creative locked</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {pastWeeks.map((w) => {
                    const s = w.stats;
                    return (
                      <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center gap-4">
                          {w.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={w.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain border border-gray-100 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <p className="text-sm font-semibold text-gray-800">{w.weekLabel}</p>
                              <span className="text-xs text-gray-400">{w.tier === "presenting" ? "Presenting Sponsor" : "Standard Sponsor"}</span>
                            </div>
                            {(s.sends > 0 || s.clicks > 0) ? (
                              <p className="text-xs text-green-700 font-medium">
                                {s.sends.toLocaleString()} sends · {s.opens.toLocaleString()} opens · {s.clicks} clicks · {ctr(s.clicks, s.opens)} CTR
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400">Results coming after your week runs.</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <StatusBadge status={w.status} />
                            <button
                              onClick={() => { setSuggestedWeek(null); setBookTier(w.tier); setView("booking"); }}
                              className="text-xs text-green-700 hover:underline font-medium"
                            >
                              Book again
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Spotlights */}
            {profile.spotlights.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Community Partner Listings</h2>
                <div className="space-y-2">
                  {profile.spotlights.map((s) => (
                    <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                      {s.logoUrl && <img src={s.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain border border-gray-100" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{s.businessName}</p>
                        <p className="text-xs text-gray-400" title={s.description}>{truncateWords(s.description, 90)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusBadge status={s.status} />
                        <button
                          onClick={() => { setEditingSpotlight(s); setSForm({ businessName: s.businessName, logoUrl: s.logoUrl || "", description: s.description, ctaLabel: s.ctaLabel, ctaUrl: s.ctaUrl }); setSError(""); setSSuccess(false); setView("spotlight"); }}
                          className="text-xs text-green-700 hover:underline"
                        >
                          Edit
                        </button>
                        {analytics && analytics.spotlightImpressions > 0 && (
                          <span className="text-xs text-green-700 font-medium">
                            {analytics.spotlightImpressions.toLocaleString()} impressions
                          </span>
                        )}
                        {analytics && analytics.spotlightClicks > 0 && (
                          <span className="text-xs text-green-700 font-medium">
                            {analytics.spotlightClicks} click{analytics.spotlightClicks !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy day-based bookings: read-only history */}
            {profile.bookings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">Past Ad Bookings</h2>
                <p className="text-xs text-gray-400 mb-3">Booked under our previous daily system — kept here for your records.</p>
                <div className="space-y-2">
                  {profile.bookings.map((b) => {
                    const clicks = analytics?.bookingClicks?.[b.id] ?? 0;
                    const impressions = analytics?.bookingImpressions?.[b.id] ?? 0;
                    const gameStats = b.type === "presenting" ? analytics?.bookingGameStats?.[b.id] : undefined;
                    const gameImpressions = gameStats ? gameStats.wordyImpressions + gameStats.matchImpressions : 0;
                    const gameClicks = gameStats ? gameStats.wordyClicks + gameStats.matchClicks : 0;
                    return (
                      <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-800">{b.date}</p>
                            <span className="text-xs text-gray-400 capitalize">{b.type === "in_article" ? "Standard" : "Presenting"}</span>
                          </div>
                          <p className="text-xs text-gray-400" title={b.headline}>{truncateWords(b.headline, 80)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <LegacyStatusBadge status={b.status} isPaid={b.isPaid} />
                          {impressions > 0 && (
                            <span className="text-xs text-green-700 font-medium">
                              {impressions.toLocaleString()} newsletter impressions
                            </span>
                          )}
                          {clicks > 0 && (
                            <span className="text-xs text-green-700 font-medium">
                              {clicks} newsletter click{clicks !== 1 ? "s" : ""} · {ctr(clicks, impressions)} CTR
                            </span>
                          )}
                          {gameImpressions > 0 && (
                            <span className="text-xs text-blue-700 font-medium">
                              {gameImpressions.toLocaleString()} game impressions
                            </span>
                          )}
                          {gameClicks > 0 && (
                            <span className="text-xs text-blue-700 font-medium">
                              {gameClicks} game click{gameClicks !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SPOTLIGHT FORM */}
        {view === "spotlight" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{editingSpotlight ? "Edit Listing" : "Community Partners"}</h1>
            <p className="text-sm text-gray-500 mb-6">{editingSpotlight ? "Update your listing details below." : "Free rotating placement in every newsletter. Your logo also feeds the homepage marquee — upload a good one."}</p>

            {sSuccess ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                <p className="text-green-800 font-semibold mb-1">Listing submitted!</p>
                <p className="text-sm text-green-600">It&apos;s live in the rotation now.</p>
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Logo <span className="font-normal text-gray-400">(shows in the newsletter and the homepage marquee)</span>
                  </label>
                  <div className="flex gap-2">
                    <UrlInput value={sForm.logoUrl} onChange={(val) => setSForm((f) => ({ ...f, logoUrl: val }))} placeholder="https://... or upload below"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    <input ref={sFileRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, setSUploading, (url) => setSForm((fm) => ({ ...fm, logoUrl: url })), setSError); }} />
                    <label onClick={() => sFileRef.current?.click()}
                      className={`cursor-pointer flex items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap ${sUploading ? "opacity-60 pointer-events-none" : ""}`}>
                      {sUploading ? "Uploading…" : "Upload"}
                    </label>
                  </div>
                  {sForm.logoUrl && (
                    <div className="mt-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sForm.logoUrl} alt="Logo preview" className="h-14 w-14 object-contain rounded-lg bg-gray-50 border border-gray-100" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">About Your Business * <span className="font-normal text-gray-400">({sForm.description.length}/300)</span></label>
                  <textarea value={sForm.description} onChange={(e) => setSForm((f) => ({ ...f, description: e.target.value }))} required rows={3} maxLength={300}
                    placeholder="1-2 sentences about what you do and why readers should visit."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Button Label</label>
                    <input type="text" value={sForm.ctaLabel} onChange={(e) => setSForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Website / CTA Link *</label>
                    <UrlInput value={sForm.ctaUrl} onChange={(val) => setSForm((f) => ({ ...f, ctaUrl: val }))} required placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>

                {sError && <p className="text-sm text-red-600">{sError}</p>}

                <div className="border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => setSShowPreview((v) => !v)}
                    className="flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 mb-3">
                    <svg className={`w-4 h-4 transition-transform ${sShowPreview ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {sShowPreview ? "Hide preview" : "Preview how it looks in the newsletter"}
                  </button>
                  {sShowPreview && (
                    <div className="mb-4">
                      <SponsorPreview data={{ type: "spotlight", businessName: sForm.businessName, logoUrl: sForm.logoUrl || undefined, description: sForm.description, ctaLabel: sForm.ctaLabel, ctaUrl: sForm.ctaUrl }} />
                    </div>
                  )}
                </div>

                <button type="submit" disabled={sSubmitting}
                  className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {sSubmitting ? (editingSpotlight ? "Saving…" : "Submitting…") : (editingSpotlight ? "Save Changes" : "Submit Listing")}
                </button>
              </form>
            )}
          </div>
        )}

        {/* BOOK A WEEK */}
        {view === "booking" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Book a Week</h1>
            <p className="text-sm text-gray-500 mb-6">Your details are pre-filled from your profile. Pick a week and check out — under a minute.</p>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Package</label>
              <div className="grid grid-cols-2 gap-2">
                {(["standard", "presenting"] as WeekTier[]).map((t) => (
                  <button key={t} type="button" onClick={() => setBookTier(t)}
                    className={`p-3 rounded-xl border text-left transition-colors ${bookTier === t ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                    <p className="text-sm font-semibold text-gray-800">{BOOK_TIER_META[t].label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{BOOK_TIER_META[t].price}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{BOOK_TIER_META[t].blurb}</p>
                  </button>
                ))}
              </div>
            </div>

            <WeekBookingFlow
              key={bookTier}
              tier={bookTier}
              prefill={prefill}
              portalToken={token}
              suggestedWeek={suggestedWeek}
              onBack={() => { setView("overview"); setSuggestedWeek(null); }}
            />
          </div>
        )}

        {/* EDIT WEEK CREATIVE */}
        {view === "editWeek" && editingWeek && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Edit Your Ad</h1>
            <p className="text-sm text-gray-500 mb-6">
              {editingWeek.tier === "presenting" ? "Presenting Sponsor" : "Standard Sponsor"} · {editingWeek.weekLabel}
              {editingWeek.chadWritesCopy && !editingWeek.finalAdCopy && (
                <span className="block mt-1 text-xs text-amber-700">Chad is writing your ad copy — you can update the logo, description, and website below.</span>
              )}
            </p>

            {wSaved && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-5 text-sm text-green-800">
                Saved! Your updated creative will run that week.
              </div>
            )}

            <form onSubmit={saveCreative} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Logo</label>
                <div className="flex gap-2 items-center">
                  <input ref={wFileRef} type="file" accept="image/png,image/jpeg" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, setWUploading, (url) => setWForm((fm) => ({ ...fm, logoUrl: url })), setWError); }} />
                  {wForm.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={wForm.logoUrl} alt="Logo preview" className="h-12 w-12 object-contain rounded-lg bg-gray-50 border border-gray-100" />
                  )}
                  <button type="button" onClick={() => wFileRef.current?.click()} disabled={wUploading}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50">
                    {wUploading ? "Uploading…" : wForm.logoUrl ? "Replace logo" : "Upload logo"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">What should readers know about your business?</label>
                <textarea value={wForm.aboutText} onChange={(e) => setWForm((f) => ({ ...f, aboutText: e.target.value }))} rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Website <span className="text-gray-400 font-normal">(optional)</span></label>
                <UrlInput value={wForm.website} onChange={(val) => setWForm((f) => ({ ...f, website: val }))} placeholder="https://"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>

              {wError && <p className="text-sm text-red-600">{wError}</p>}

              <div className="border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setWShowPreview((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 mb-3">
                  <svg className={`w-4 h-4 transition-transform ${wShowPreview ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {wShowPreview ? "Hide preview" : "Preview how it looks in the newsletter"}
                </button>
                {wShowPreview && (
                  <div className="mb-4">
                    <SponsorPreview data={
                      editingWeek.tier === "presenting"
                        ? { type: "presenting", businessName: editingWeek.businessName, imageUrl: wForm.logoUrl || undefined, headline: editingWeek.businessName, body: editingWeek.finalAdCopy || wForm.aboutText, ctaLabel: "Learn More", ctaUrl: wForm.website || undefined }
                        : { type: "in_article", imageUrl: wForm.logoUrl || undefined, headline: editingWeek.businessName, body: editingWeek.finalAdCopy || wForm.aboutText, ctaLabel: "Learn More", ctaUrl: wForm.website || undefined }
                    } />
                  </div>
                )}
              </div>

              <button type="submit" disabled={wSaving || wUploading}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {wSaving ? "Saving…" : "Save Changes"}
              </button>
              <p className="text-xs text-gray-400 text-center">Creative locks 24 hours before your week starts.</p>
            </form>
          </div>
        )}

        {/* BILLING */}
        {view === "billing" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Payment History</h1>
            <p className="text-sm text-gray-500 mb-6">Every payment for your sponsorship weeks, with receipts.</p>

            {billingLoading && <p className="text-sm text-gray-500 py-8 text-center">Loading payments…</p>}
            {billingError && <p className="text-sm text-red-600 py-4">{billingError}</p>}
            {!billingLoading && !billingError && payments && payments.length === 0 && (
              <p className="text-sm text-gray-500 py-8 text-center">No payments yet. Book a week to get started.</p>
            )}
            {!billingLoading && !billingError && payments && payments.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {payments.map((p) => (
                  <div key={p.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{p.weekLabel}</p>
                      <p className="text-xs text-gray-400">
                        {p.tierLabel} · {new Date(p.paidAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{formatMoney(p.amountCents)}</p>
                    {p.receiptUrl ? (
                      <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 hover:underline font-medium shrink-0">
                        Receipt ↗
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300 shrink-0">Paid</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE EDIT */}
        {view === "profile" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Edit Profile</h1>
            <p className="text-sm text-gray-500 mb-6">Update your business name and contact information.</p>
            <form onSubmit={saveProfile} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name *</label>
                <input
                  type="text"
                  value={pForm.businessName}
                  onChange={(e) => setPForm((f) => ({ ...f, businessName: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Name *</label>
                <input
                  type="text"
                  value={pForm.contactName}
                  onChange={(e) => setPForm((f) => ({ ...f, contactName: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {pError && <p className="text-sm text-red-600">{pError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pSaving}
                  className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
                >
                  {pSaving ? "Saving…" : "Save Changes"}
                </button>
                {pSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
              </div>
            </form>
          </div>
        )}

        {/* EVENT SUBMISSION FORM */}
        {view === "event" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Submit an Event</h1>
            <p className="text-sm text-gray-500 mb-6">Free for Community Partners. We&apos;ll review and include it in an upcoming newsletter calendar block.</p>

            {eSuccess ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                <p className="text-green-800 font-semibold mb-1">Event submitted!</p>
                <p className="text-sm text-green-600">We&apos;ll review it within 1-2 business days.</p>
                <div className="flex gap-3 justify-center mt-4">
                  <button onClick={() => setESuccess(false)} className="text-sm text-green-700 underline">Submit another event</button>
                  <button onClick={() => { setESuccess(false); setView("overview"); }} className="text-sm text-gray-500 underline">Back to portal</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitEvent} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Event Name *</label>
                  <input type="text" required value={eForm.title} onChange={(e) => setEForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Decatur Farmers Market"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
                    <input type="date" required value={eForm.eventDate} onChange={(e) => setEForm((f) => ({ ...f, eventDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time</label>
                      <input type="text" placeholder="7:00 PM" value={eForm.startTime} onChange={(e) => setEForm((f) => ({ ...f, startTime: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">End Time</label>
                      <input type="text" placeholder="9:00 PM" value={eForm.endTime} onChange={(e) => setEForm((f) => ({ ...f, endTime: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                    <input type="text" placeholder="Address or venue name" value={eForm.location} onChange={(e) => setEForm((f) => ({ ...f, location: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Cost</label>
                    <input type="text" placeholder="Free, $10, etc." value={eForm.cost} onChange={(e) => setEForm((f) => ({ ...f, cost: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
                  <textarea value={eForm.description} onChange={(e) => setEForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                    placeholder="1-2 sentences about the event."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Link <span className="font-normal text-gray-400">(more info / tickets, optional)</span></label>
                  <UrlInput placeholder="https://" value={eForm.url} onChange={(val) => setEForm((f) => ({ ...f, url: val }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                {eError && <p className="text-sm text-red-600">{eError}</p>}
                <button type="submit" disabled={eSubmitting}
                  className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {eSubmitting ? "Submitting…" : "Submit Event for Review"}
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
