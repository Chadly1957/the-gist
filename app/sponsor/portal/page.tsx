"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import SponsorPreview from "@/components/SponsorPreview";
import UrlInput from "@/components/UrlInput";

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

interface Analytics {
  spotlightClicks: number;
  spotlightImpressions: number;
  adClicks: number;
  adImpressions: number;
  bookingClicks: Record<string, number>;
  bookingImpressions: Record<string, number>;
}

type View = "overview" | "spotlight" | "booking" | "profile" | "event";

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

interface DayAvailability {
  inArticle: number;
  presenting: number;
}

function BookingDatePicker({
  selectedDates,
  onToggleDate,
  adType,
}: {
  selectedDates: string[];
  onToggleDate: (date: string) => void;
  adType: "in_article" | "presenting";
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [availability, setAvailability] = useState<Record<string, Record<string, DayAvailability>>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthKey = `${year}-${month + 1}`;

  useEffect(() => {
    if (availability[monthKey]) return;
    fetch(`/api/sponsor/calendar?year=${year}&month=${month + 1}`)
      .then((r) => r.json())
      .then((data) => setAvailability((prev) => ({ ...prev, [monthKey]: data.availability || {} })));
  }, [monthKey, year, month, availability]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const todayStr = new Date().toISOString().split("T")[0];

  function isUnavailable(dateStr: string) {
    if (dateStr < todayStr) return true;
    const day = availability[monthKey]?.[dateStr];
    if (!day) return false;
    return adType === "in_article" ? day.inArticle >= 2 : day.presenting >= 1;
  }

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells: (string | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
    ),
  ];

  const summary =
    selectedDates.length === 0
      ? "Select date(s)…"
      : selectedDates.length === 1
      ? new Date(selectedDates[0] + "T00:00:00").toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : `${selectedDates.length} dates selected`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
      >
        <span className={selectedDates.length ? "text-gray-800" : "text-gray-400"}>{summary}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-1 text-gray-400 hover:text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-sm font-semibold text-gray-700">
              {firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-1 text-gray-400 hover:text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const disabled = isUnavailable(dateStr);
              const selected = selectedDates.includes(dateStr);
              const dayNum = parseInt(dateStr.split("-")[2], 10);
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggleDate(dateStr)}
                  className={`text-xs py-1.5 rounded-lg transition-colors ${
                    disabled
                      ? "text-gray-300 cursor-not-allowed"
                      : selected
                      ? "bg-green-600 text-white font-semibold"
                      : "text-gray-700 hover:bg-green-50"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">{selectedDates.length} selected</p>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-green-700 hover:underline">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
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

  // Booking form
  const [bType, setBType] = useState<"in_article" | "presenting">("in_article");
  const [bDates, setBDates] = useState<string[]>([]);
  const [bForm, setBForm] = useState({ headline: "", body: "", ctaUrl: "", ctaLabel: "Learn More", imageUrl: "", presentingBlurb: "" });
  const [bUploading, setBUploading] = useState(false);
  const [bSubmitting, setBSubmitting] = useState(false);
  const [bError, setBError] = useState("");
  const [bSuccess, setBSuccess] = useState(false);
  const [bPartialErrors, setBPartialErrors] = useState<{ date: string; error: string }[]>([]);
  const [bShowPreview, setBShowPreview] = useState(false);
  const [bAutoFilled, setBAutoFilled] = useState(false);
  const bFileRef = useRef<HTMLInputElement>(null);

  // Callout bubble on "Book Ad Date" — shown after listing creation
  const [showBookingCallout, setShowBookingCallout] = useState(false);

  // Event form
  const [eForm, setEForm] = useState({ title: "", description: "", eventDate: "", startTime: "", endTime: "", location: "", url: "", cost: "" });
  const [eSubmitting, setESubmitting] = useState(false);
  const [eError, setEError] = useState("");
  const [eSuccess, setESuccess] = useState(false);

  function toggleBookingDate(date: string) {
    setBDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]));
  }

  useEffect(() => {
    if (!token) { setError("No portal link provided."); setLoading(false); return; }
    fetch(`/api/sponsor/portal?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); }
        else {
          setProfile(data.profile);
          setAnalytics(data.analytics ?? null);
          setSForm((f) => ({ ...f, businessName: data.profile.businessName }));
        }
      })
      .catch(() => setError("Failed to load. Please try again."))
      .finally(() => setLoading(false));

    // Show callout if redirected here right after listing creation
    if (searchParams.get("callout") === "booking") {
      setShowBookingCallout(true);
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
      const res = await fetch("/api/sponsor/upload", { method: "POST", body: fd });
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
        const res = await fetch("/api/sponsor/spotlight", {
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
        const res = await fetch("/api/sponsor/spotlight", {
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
      const res = await fetch("/api/sponsor/portal", {
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

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (bDates.length === 0) { setBError("Select at least one date."); return; }
    setBSubmitting(true); setBError(""); setBPartialErrors([]);

    const succeeded: Booking[] = [];
    const failed: { date: string; error: string }[] = [];

    for (const date of bDates) {
      try {
        const res = await fetch("/api/sponsor/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, type: bType, date, ...bForm }),
        });
        const data = await res.json();
        if (res.ok) succeeded.push(data.booking);
        else failed.push({ date, error: data.error || "Submission failed." });
      } catch (_e) {
        failed.push({ date, error: "Connection error." });
      }
    }

    if (succeeded.length > 0) {
      setProfile((p) => (p ? { ...p, bookings: [...p.bookings, ...succeeded] } : p));
    }
    if (succeeded.length > 0) {
      setBSuccess(true);
      setBPartialErrors(failed);
    } else {
      setBError(failed.map((f) => `${f.date}: ${f.error}`).join(" "));
    }
    setBSubmitting(false);
  }

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    setESubmitting(true); setEError("");
    try {
      const res = await fetch("/api/sponsor/events", {
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
        <a href="/sponsor/apply" className="text-sm text-green-700 underline">Resend my portal link or apply for a new one</a>
      </div>
    </div>
  );

  if (!profile) return null;

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
          <a href="/sponsor" className="text-xs text-gray-400 hover:text-gray-600">Sponsorship Info</a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Navigation */}
        {view !== "overview" && (
          <button onClick={() => { if (sSuccess) setShowBookingCallout(true); setView("overview"); setSSuccess(false); setBSuccess(false); setEditingSpotlight(null); }} className="text-sm text-green-700 hover:underline mb-6 inline-block">
            ← Back to overview
          </button>
        )}

        {/* OVERVIEW */}
        {view === "overview" && (
          <div className="space-y-6">
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
                          {analytics.spotlightImpressions > 0 && ` · ${((analytics.spotlightClicks / analytics.spotlightImpressions) * 100).toFixed(1)}% CTR`}
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
                          {analytics.adImpressions > 0 && ` · ${((analytics.adClicks / analytics.adImpressions) * 100).toFixed(1)}% CTR`}
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
                onClick={() => {
                  const approved = profile?.spotlights.find(s => s.status === "approved");
                  if (approved) {
                    setBForm({
                      headline: `Visit ${approved.businessName}`,
                      body: approved.description,
                      ctaUrl: approved.ctaUrl,
                      ctaLabel: approved.ctaLabel || "Learn More",
                      imageUrl: approved.logoUrl || "",
                      presentingBlurb: "",
                    });
                    setBAutoFilled(true);
                  } else {
                    setBAutoFilled(false);
                  }
                  setShowBookingCallout(false);
                  setView("booking");
                  setBSuccess(false);
                  setBError("");
                }}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-sm transition-all text-left relative"
              >
                {showBookingCallout && (
                  <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none z-10">
                    <div className="bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-bounce">
                      Schedule an ad now for maximum engagement!
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-green-700" />
                    </div>
                  </div>
                )}
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Book Ad Date</p>
                  <p className="text-xs text-gray-400">Standard or presenting sponsor</p>
                </div>
              </button>
              <button
                onClick={() => { setView("event"); setESuccess(false); setEError(""); }}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-green-400 hover:shadow-sm transition-all text-left col-span-2 sm:col-span-1"
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
            </div>

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
                        <p className="text-xs text-gray-400 truncate">{s.description}</p>
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

            {/* Bookings */}
            {profile.bookings.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Ad Bookings</h2>
                <div className="space-y-2">
                  {profile.bookings.map((b) => {
                    const clicks = analytics?.bookingClicks?.[b.id] ?? 0;
                    const impressions = analytics?.bookingImpressions?.[b.id] ?? 0;
                    return (
                      <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-800">{b.date}</p>
                            <span className="text-xs text-gray-400 capitalize">{b.type === "in_article" ? "Standard" : "Presenting"}</span>
                          </div>
                          <p className="text-xs text-gray-400 truncate">{b.headline}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <StatusBadge status={b.status} />
                          {impressions > 0 && (
                            <span className="text-xs text-green-700 font-medium">
                              {impressions.toLocaleString()} impressions
                            </span>
                          )}
                          {clicks > 0 && (
                            <span className="text-xs text-green-700 font-medium">
                              {clicks} click{clicks !== 1 ? "s" : ""}
                            </span>
                          )}
                          {!b.isPaid && b.status !== "rejected" && (
                            <span className="text-xs text-orange-600 font-medium">Payment pending</span>
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
            <p className="text-sm text-gray-500 mb-6">{editingSpotlight ? "Update your listing details below." : "Free rotating placement in every newsletter. Submit your listing and we’ll review it within 1-2 business days."}</p>

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
                    <UrlInput value={sForm.logoUrl} onChange={(val) => setSForm((f) => ({ ...f, logoUrl: val }))} placeholder="https://... or upload below"
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
                  {sSubmitting ? (editingSpotlight ? "Saving…" : "Submitting…") : (editingSpotlight ? "Save Changes" : "Submit Listing for Review")}
                </button>
              </form>
            )}
          </div>
        )}

        {/* BOOKING FORM */}
        {view === "booking" && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Book an Ad Date</h1>
            <p className="text-sm text-gray-500 mb-1">Choose your ad type, pick a date, and fill in your ad content. We&apos;ll review and confirm within 1-2 business days. Payment is collected separately.</p>
            {bAutoFilled && (
              <p className="text-xs text-green-600 mb-5">✓ Pre-filled from your Community Partners listing — edit as needed.</p>
            )}
            {!bAutoFilled && <div className="mb-5" />}

            {bSuccess ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
                <p className="text-green-800 font-semibold mb-1">Booking submitted!</p>
                <p className="text-sm text-green-600">We&apos;ll review it and reach out to confirm and collect payment.</p>
                {bPartialErrors.length > 0 && (
                  <div className="mt-3 text-left bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Some dates couldn&apos;t be booked:</p>
                    {bPartialErrors.map((f) => (
                      <p key={f.date} className="text-xs text-amber-700">{f.date}: {f.error}</p>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 justify-center mt-4">
                  <button onClick={() => { setBSuccess(false); setBPartialErrors([]); setBForm({ headline: "", body: "", ctaUrl: "", ctaLabel: "Learn More", imageUrl: "", presentingBlurb: "" }); setBDates([]); setBAutoFilled(false); }}
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
                      <button key={t} type="button" onClick={() => { setBType(t); setBDates([]); }}
                        className={`p-3 rounded-xl border text-left transition-colors ${bType === t ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                        <p className="text-sm font-semibold text-gray-800">{t === "in_article" ? "Standard: $15/day" : "Presenting Sponsor: $25/day"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t === "in_article" ? "Mixed in with the newsletter" : "Opening mention + standard ad"}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Newsletter Date(s) *</label>
                  <BookingDatePicker selectedDates={bDates} onToggleDate={toggleBookingDate} adType={bType} />
                  <p className="text-xs text-gray-400 mt-1">
                    Click to select one or more dates. Grayed-out days are already fully booked.{" "}
                    {bType === "in_article" ? "Up to 2 standard ad slots per day." : "Only 1 presenting sponsor per day."}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Image</label>
                  <div className="flex gap-2">
                    <UrlInput value={bForm.imageUrl} onChange={(val) => setBForm((f) => ({ ...f, imageUrl: val }))} placeholder="https://... or upload"
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Body Copy * <span className="font-normal text-gray-400">({bForm.body.length}/400)</span></label>
                  <textarea value={bForm.body} onChange={(e) => setBForm((f) => ({ ...f, body: e.target.value }))} required rows={4} maxLength={400}
                    placeholder="Tell readers what you offer and why they should click."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Label</label>
                    <input type="text" value={bForm.ctaLabel} onChange={(e) => setBForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Link *</label>
                    <UrlInput value={bForm.ctaUrl} onChange={(val) => setBForm((f) => ({ ...f, ctaUrl: val }))} required placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>

                {bType === "presenting" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Custom Intro Blurb <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea value={bForm.presentingBlurb} onChange={(e) => setBForm((f) => ({ ...f, presentingBlurb: e.target.value }))} rows={2}
                      placeholder={`e.g. "Today's Gist is brought to you by Decatur Coffee Co., your neighborhood spot for great coffee and community." Leave blank to use the default.`}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                  </div>
                )}

                {bError && <p className="text-sm text-red-600">{bError}</p>}

                <div className="border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => setBShowPreview((v) => !v)}
                    className="flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 mb-3">
                    <svg className={`w-4 h-4 transition-transform ${bShowPreview ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {bShowPreview ? "Hide preview" : "Preview how it looks in the newsletter"}
                  </button>
                  {bShowPreview && (
                    <div className="mb-4">
                      <SponsorPreview data={bType === "presenting"
                        ? { type: "presenting", businessName: profile?.businessName, imageUrl: bForm.imageUrl || undefined, headline: bForm.headline, body: bForm.body, ctaLabel: bForm.ctaLabel, ctaUrl: bForm.ctaUrl, presentingBlurb: bForm.presentingBlurb || undefined }
                        : { type: "in_article", imageUrl: bForm.imageUrl || undefined, headline: bForm.headline, body: bForm.body, ctaLabel: bForm.ctaLabel, ctaUrl: bForm.ctaUrl }
                      } />
                    </div>
                  )}
                </div>

                <button type="submit" disabled={bSubmitting}
                  className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                  {bSubmitting ? "Submitting…" : "Submit Booking for Review"}
                </button>
              </form>
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
