"use client";

import { useEffect, useState } from "react";
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
  shownCount: number;
  lastShownAt: string | null;
  createdAt: string;
  sponsor: { businessName: string; contactName: string; email: string; magicToken: string };
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
  ctaLabel: string;
  imageUrl: string | null;
  presentingBlurb: string | null;
  adminNotes: string | null;
  createdAt: string;
  sponsor: { businessName: string; contactName: string; email: string };
}

interface Profile {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
  portalUrl: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  pending_review: "bg-yellow-50 text-yellow-700",
  pending_payment: "bg-orange-50 text-orange-700",
  approved: "bg-green-50 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  rejected: "bg-red-50 text-red-600",
  completed: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  pending_payment: "Awaiting Payment",
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? (status.charAt(0).toUpperCase() + status.slice(1));
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || "bg-gray-100 text-gray-500"}`}>{label}</span>;
}

function BookingsCalendar({
  bookings,
  year,
  month,
  onPrev,
  onNext,
  onDateClick,
}: {
  bookings: Booking[];
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onDateClick?: (date: string) => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const byDate = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!["approved", "pending_review", "pending_payment"].includes(b.status)) continue;
    const existing = byDate.get(b.date) ?? [];
    existing.push(b);
    byDate.set(b.date, existing);
  }

  function pad(n: number) { return String(n).padStart(2, "0"); }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg leading-none">‹</button>
        <h3 className="text-sm font-semibold text-gray-800">{monthLabel}</h3>
        <button onClick={onNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg leading-none">›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[60px]" />;
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
          const dayBookings = byDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;

          const clickable = !!onDateClick;

          return (
            <div
              key={i}
              onClick={() => clickable && onDateClick!(dateStr)}
              className={`min-h-[60px] p-1 rounded-lg ${isToday ? "ring-2 ring-green-500 ring-inset" : ""} ${dayBookings.length > 0 ? "bg-gray-50" : ""} ${clickable ? "cursor-pointer hover:bg-green-50 transition-colors" : ""}`}
            >
              <div className={`text-[11px] font-semibold mb-0.5 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-green-600 text-white" : "text-gray-500"}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayBookings.map((b) => (
                  <div
                    key={b.id}
                    title={`${b.sponsor.businessName} — ${b.type === "presenting" ? "Presenting" : "Standard"} (${b.status === "approved" ? "Approved" : "Pending"})`}
                    className={`text-[9px] font-bold px-1 py-px rounded leading-tight truncate ${
                      b.status === "pending_review"
                        ? "bg-amber-100 text-amber-700"
                        : b.type === "presenting"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {b.type === "presenting" ? "PRE" : "STD"} · {b.sponsor.businessName.slice(0, 7)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="w-6 h-3 rounded bg-green-100 inline-block shrink-0" />Approved Standard
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="w-6 h-3 rounded bg-blue-100 inline-block shrink-0" />Approved Presenting
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="w-6 h-3 rounded bg-amber-100 inline-block shrink-0" />Pending Review
        </span>
      </div>
    </div>
  );
}

export default function AdminSponsorsPage() {
  const [tab, setTab] = useState<"spotlights" | "bookings" | "profiles" | "pricing">("spotlights");
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Bookings calendar
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  function calPrev() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }
  function calNext() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  // Sponsor email compose
  const [emailTarget, setEmailTarget] = useState<Profile | "bulk" | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; message: string } | null>(null);

  function openEmail(target: Profile | "bulk") {
    setEmailTarget(target);
    setEmailSubject("");
    setEmailBody("");
    setEmailResult(null);
  }

  function closeEmail() {
    setEmailTarget(null);
    setEmailSubject("");
    setEmailBody("");
    setEmailResult(null);
  }

  async function sendSponsorEmail() {
    setEmailSending(true);
    setEmailResult(null);
    const payload =
      emailTarget === "bulk"
        ? { bulk: true, subject: emailSubject, htmlBody: emailBody }
        : { profileId: (emailTarget as Profile).id, subject: emailSubject, htmlBody: emailBody };
    try {
      const res = await fetch("/api/admin/sponsors/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const msg =
          emailTarget === "bulk"
            ? `Sent to ${data.sent} sponsor${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? `, ${data.failed} failed` : ""}.`
            : "Email sent!";
        setEmailResult({ ok: true, message: msg });
      } else {
        setEmailResult({ ok: false, message: data.error || "Send failed." });
      }
    } catch {
      setEmailResult({ ok: false, message: "Network error." });
    }
    setEmailSending(false);
  }

  // New booking modal (triggered by calendar date click)
  const [newBookingDate, setNewBookingDate] = useState<string | null>(null);
  const [newBookingForm, setNewBookingForm] = useState({
    profileId: "",
    type: "in_article",
    date: "",
    headline: "",
    body: "",
    ctaUrl: "",
    ctaLabel: "",
    imageUrl: "",
    presentingBlurb: "",
  });
  const [newBookingAutoFilled, setNewBookingAutoFilled] = useState(false);
  const [newBookingSubmitting, setNewBookingSubmitting] = useState(false);
  const [newBookingError, setNewBookingError] = useState<string | null>(null);

  function openNewBookingModal(date: string) {
    setNewBookingDate(date);
    setNewBookingForm({ profileId: "", type: "in_article", date, headline: "", body: "", ctaUrl: "", ctaLabel: "", imageUrl: "", presentingBlurb: "" });
    setNewBookingAutoFilled(false);
    setNewBookingError(null);
  }

  function closeNewBookingModal() {
    setNewBookingDate(null);
    setNewBookingError(null);
  }

  async function submitNewBooking() {
    setNewBookingSubmitting(true);
    setNewBookingError(null);
    try {
      const res = await fetch("/api/admin/sponsors/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBookingForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewBookingError(data.error || "Failed to create booking.");
        setNewBookingSubmitting(false);
        return;
      }
      closeNewBookingModal();
      load();
    } catch {
      setNewBookingError("Network error.");
    }
    setNewBookingSubmitting(false);
  }

  // Edit forms
  const [editingSpotlightId, setEditingSpotlightId] = useState<string | null>(null);
  const [spotlightForm, setSpotlightForm] = useState({ businessName: "", logoUrl: "", description: "", ctaLabel: "", ctaUrl: "" });
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState({ type: "in_article", date: "", headline: "", body: "", ctaUrl: "", ctaLabel: "", imageUrl: "", presentingBlurb: "" });
  const [bookingAutoFilled, setBookingAutoFilled] = useState(false);

  // Pricing state
  const [prices, setPrices] = useState({
    sponsorship_price_spotlight: "Free",
    sponsorship_price_in_article: "$15/day",
    sponsorship_price_presenting: "$25/day",
  });
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceSaved, setPriceSaved] = useState(false);

  async function load() {
    setLoading(true);
    const [sponsorRes, settingsRes] = await Promise.all([
      fetch("/api/admin/sponsors"),
      fetch("/api/admin/settings"),
    ]);
    const data = await sponsorRes.json();
    const settingsData = await settingsRes.json();
    setSpotlights(data.spotlights || []);
    setBookings(data.bookings || []);
    setProfiles(data.profiles || []);
    setPrices((p) => ({ ...p, ...Object.fromEntries(
      Object.entries(settingsData.settings || {}).filter(([k]) => k.startsWith("sponsorship_price_"))
    )}));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function savePrices() {
    setPriceSaving(true);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: prices }),
    });
    setPriceSaving(false);
    setPriceSaved(true);
    setTimeout(() => setPriceSaved(false), 3000);
  }

  async function updateSpotlight(id: string, patch: object) {
    await fetch(`/api/admin/sponsors/spotlight/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function deleteSpotlight(id: string) {
    if (!confirm("Delete this spotlight listing?")) return;
    await fetch(`/api/admin/sponsors/spotlight/${id}`, { method: "DELETE" });
    load();
  }

  function startEditSpotlight(s: Spotlight) {
    setEditingSpotlightId(s.id);
    setSpotlightForm({
      businessName: s.businessName,
      logoUrl: s.logoUrl || "",
      description: s.description,
      ctaLabel: s.ctaLabel,
      ctaUrl: s.ctaUrl,
    });
  }

  async function saveSpotlightEdit(id: string) {
    await updateSpotlight(id, spotlightForm);
    setEditingSpotlightId(null);
  }

  async function updateBooking(id: string, patch: object) {
    await fetch(`/api/admin/sponsors/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function duplicateBooking(b: Booking) {
    const res = await fetch(`/api/admin/sponsors/bookings/${b.id}/duplicate`, { method: "POST" });
    if (!res.ok) return;
    const { booking: copy } = await res.json();
    // Insert at top of list and immediately open edit form so user can change the date
    setBookings((prev) => [copy, ...prev]);
    setBookingForm({
      type: copy.type,
      date: copy.date,
      headline: copy.headline,
      body: copy.body,
      ctaUrl: copy.ctaUrl,
      ctaLabel: copy.ctaLabel,
      imageUrl: copy.imageUrl || "",
      presentingBlurb: copy.presentingBlurb || "",
    });
    setExpandedId(copy.id);
    setEditingBookingId(copy.id);
  }

  async function deleteBooking(id: string) {
    if (!confirm("Delete this booking?")) return;
    await fetch(`/api/admin/sponsors/bookings/${id}`, { method: "DELETE" });
    load();
  }

  function startEditBooking(b: Booking) {
    setEditingBookingId(b.id);
    setBookingAutoFilled(false);
    setBookingForm({
      type: b.type,
      date: b.date,
      headline: b.headline,
      body: b.body,
      ctaUrl: b.ctaUrl,
      ctaLabel: b.ctaLabel,
      imageUrl: b.imageUrl || "",
      presentingBlurb: b.presentingBlurb || "",
    });
  }

  async function saveBookingEdit(id: string) {
    await updateBooking(id, bookingForm);
    setEditingBookingId(null);
  }

  const pendingCount = spotlights.filter((s) => s.status === "pending").length + bookings.filter((b) => b.status === "pending_review").length;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sponsors</h1>
        {pendingCount > 0 && (
          <p className="text-sm text-orange-600 mt-1">{pendingCount} item{pendingCount !== 1 ? "s" : ""} pending review</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["spotlights", "bookings", "profiles", "pricing"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t}
            {t === "spotlights" && spotlights.filter((s) => s.status === "pending").length > 0 && (
              <span className="ml-1.5 bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {spotlights.filter((s) => s.status === "pending").length}
              </span>
            )}
            {t === "bookings" && bookings.filter((b) => b.status === "pending_review").length > 0 && (
              <span className="ml-1.5 bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                {bookings.filter((b) => b.status === "pending_review").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* SPOTLIGHTS */}
          {tab === "spotlights" && (
            <div className="space-y-3">
              {spotlights.length === 0 && <p className="text-sm text-gray-400">No spotlight listings yet.</p>}
              {spotlights.map((s) => (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200">
                  <div className="p-4 flex items-start gap-4">
                    {s.logoUrl && <img src={s.logoUrl} alt="" className="w-12 h-12 rounded-lg object-contain border border-gray-100 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-gray-800">{s.businessName}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{s.description}</p>
                      <p className="text-xs text-gray-400">
                        From: {s.sponsor.contactName} ({s.sponsor.email}) · Shown {s.shownCount}×
                      </p>
                    </div>
                    <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
                      {expandedId === s.id ? "Close" : "Manage"}
                    </button>
                  </div>
                  {expandedId === s.id && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl space-y-3">
                      {editingSpotlightId === s.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name</label>
                            <input type="text" value={spotlightForm.businessName}
                              onChange={(e) => setSpotlightForm((f) => ({ ...f, businessName: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Logo URL</label>
                            <UrlInput value={spotlightForm.logoUrl}
                              onChange={(val) => setSpotlightForm((f) => ({ ...f, logoUrl: val }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                            <textarea value={spotlightForm.description} rows={2} maxLength={300}
                              onChange={(e) => setSpotlightForm((f) => ({ ...f, description: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Button Label</label>
                              <input type="text" value={spotlightForm.ctaLabel}
                                onChange={(e) => setSpotlightForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">CTA / Website Link</label>
                              <UrlInput value={spotlightForm.ctaUrl}
                                onChange={(val) => setSpotlightForm((f) => ({ ...f, ctaUrl: val }))}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveSpotlightEdit(s.id)}
                              className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800">
                              Save Changes
                            </button>
                            <button onClick={() => setEditingSpotlightId(null)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {s.status !== "approved" && (
                              <button onClick={() => updateSpotlight(s.id, { status: "approved" })}
                                className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800">
                                Approve
                              </button>
                            )}
                            {s.status !== "expired" && (
                              <button onClick={() => updateSpotlight(s.id, { status: "expired" })}
                                className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                                Expire
                              </button>
                            )}
                            <button onClick={() => startEditSpotlight(s)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              Edit
                            </button>
                            <button onClick={() => setPreviewId(previewId === s.id ? null : s.id)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              {previewId === s.id ? "Hide Preview" : "Preview"}
                            </button>
                            <a href={s.ctaUrl} target="_blank" rel="noopener noreferrer"
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              Visit Site ↗
                            </a>
                            <button onClick={() => deleteSpotlight(s.id)} className="px-3 py-1.5 text-red-500 hover:text-red-700 text-xs font-semibold">
                              Delete
                            </button>
                          </div>
                          <a href={`/sponsor/portal?token=${s.sponsor.magicToken}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-green-700 underline">
                            Open sponsor portal ↗
                          </a>
                          {previewId === s.id && (
                            <div className="mt-3">
                              <SponsorPreview data={{ type: "spotlight", businessName: s.businessName, logoUrl: s.logoUrl ?? undefined, description: s.description, ctaLabel: s.ctaLabel, ctaUrl: s.ctaUrl }} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* BOOKINGS */}
          {tab === "bookings" && (
            <div className="space-y-3">
              <BookingsCalendar
                bookings={bookings}
                year={calYear}
                month={calMonth}
                onPrev={calPrev}
                onNext={calNext}
                onDateClick={openNewBookingModal}
              />
              {bookings.length === 0 && <p className="text-sm text-gray-400">No ad bookings yet.</p>}
              {bookings.map((b) => (
                <div key={b.id} className="bg-white rounded-xl border border-gray-200">
                  <div className="p-4 flex items-start gap-4">
                    {b.imageUrl && <img src={b.imageUrl} alt="" className="w-16 h-12 rounded-lg object-cover border border-gray-100 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-gray-800">{b.date}</p>
                        <span className="text-xs text-gray-500 capitalize">{b.type === "in_article" ? "Standard" : "Presenting"}</span>
                        <StatusBadge status={b.status} />
                        {b.isPaid ? (
                          <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Paid</span>
                        ) : (
                          <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">Unpaid</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-700">{b.headline}</p>
                      <p className="text-xs text-gray-400">{b.sponsor.contactName} ({b.sponsor.email})</p>
                    </div>
                    <button onClick={() => setExpandedId(expandedId === b.id ? null : b.id)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
                      {expandedId === b.id ? "Close" : "Manage"}
                    </button>
                  </div>
                  {expandedId === b.id && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl space-y-3">
                      {editingBookingId === b.id ? (
                        <div className="space-y-3">
                          {(() => {
                            const listing = spotlights.find(s => s.sponsor.email === b.sponsor.email && s.status === "approved");
                            if (!listing) return null;
                            return (
                              <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                                <p className="text-xs text-green-700">Community Partners listing available</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBookingForm(f => ({
                                      ...f,
                                      headline: `Visit ${listing.businessName}`,
                                      body: listing.description,
                                      ctaUrl: listing.ctaUrl,
                                      ctaLabel: listing.ctaLabel,
                                      imageUrl: listing.logoUrl || "",
                                    }));
                                    setBookingAutoFilled(true);
                                  }}
                                  className="text-xs font-semibold text-green-700 hover:text-green-800"
                                >
                                  Auto-fill from listing
                                </button>
                              </div>
                            );
                          })()}
                          {bookingAutoFilled && (
                            <p className="text-xs text-green-600">✓ Auto-filled from their Community Partners listing</p>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Type</label>
                              <select value={bookingForm.type}
                                onChange={(e) => setBookingForm((f) => ({ ...f, type: e.target.value }))}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                                <option value="in_article">Standard</option>
                                <option value="presenting">Presenting</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Newsletter Date</label>
                              <input type="date" value={bookingForm.date}
                                onChange={(e) => setBookingForm((f) => ({ ...f, date: e.target.value }))}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Image URL</label>
                            <UrlInput value={bookingForm.imageUrl}
                              onChange={(val) => setBookingForm((f) => ({ ...f, imageUrl: val }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Headline</label>
                            <input type="text" value={bookingForm.headline}
                              onChange={(e) => setBookingForm((f) => ({ ...f, headline: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Body Copy</label>
                            <textarea value={bookingForm.body} rows={4} maxLength={400}
                              onChange={(e) => setBookingForm((f) => ({ ...f, body: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Label</label>
                              <input type="text" value={bookingForm.ctaLabel}
                                onChange={(e) => setBookingForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Link</label>
                              <UrlInput value={bookingForm.ctaUrl}
                                onChange={(val) => setBookingForm((f) => ({ ...f, ctaUrl: val }))}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                          </div>
                          {bookingForm.type === "presenting" && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Custom Intro Blurb</label>
                              <textarea value={bookingForm.presentingBlurb} rows={2}
                                onChange={(e) => setBookingForm((f) => ({ ...f, presentingBlurb: e.target.value }))}
                                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => saveBookingEdit(b.id)}
                              className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800">
                              Save Changes
                            </button>
                            <button onClick={() => setEditingBookingId(null)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs text-gray-600 space-y-1">
                            <p><strong>Body:</strong> {b.body}</p>
                            <p><strong>CTA:</strong> <a href={b.ctaUrl} target="_blank" rel="noopener noreferrer" className="text-green-700 underline">{b.ctaUrl}</a></p>
                            {b.presentingBlurb && <p><strong>Custom blurb:</strong> {b.presentingBlurb}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {b.status === "pending_review" && (
                              <button onClick={() => updateBooking(b.id, { status: "approved" })}
                                className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800">
                                Approve
                              </button>
                            )}
                            {b.status === "pending_review" && (
                              <button onClick={() => updateBooking(b.id, { status: "rejected" })}
                                className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                                Reject
                              </button>
                            )}
                            <button onClick={() => updateBooking(b.id, { isPaid: !b.isPaid })}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              Mark as {b.isPaid ? "Unpaid" : "Paid"}
                            </button>
                            {b.status === "approved" && (
                              <button onClick={() => updateBooking(b.id, { status: "completed" })}
                                className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                                Mark Complete
                              </button>
                            )}
                            <button onClick={() => startEditBooking(b)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              Edit
                            </button>
                            <button onClick={() => duplicateBooking(b)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              Duplicate
                            </button>
                            <button onClick={() => setPreviewId(previewId === b.id ? null : b.id)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                              {previewId === b.id ? "Hide Preview" : "Preview"}
                            </button>
                            <button onClick={() => deleteBooking(b.id)} className="px-3 py-1.5 text-red-500 hover:text-red-700 text-xs font-semibold">
                              Delete
                            </button>
                          </div>
                          {previewId === b.id && (
                            <div className="mt-3">
                              <SponsorPreview data={b.type === "presenting" ? { type: "presenting", businessName: b.sponsor.businessName, imageUrl: b.imageUrl ?? undefined, headline: b.headline, body: b.body, ctaLabel: b.ctaLabel, ctaUrl: b.ctaUrl, presentingBlurb: b.presentingBlurb ?? undefined } : { type: "in_article", businessName: b.sponsor.businessName, imageUrl: b.imageUrl ?? undefined, headline: b.headline, body: b.body, ctaLabel: b.ctaLabel, ctaUrl: b.ctaUrl }} />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PROFILES */}
          {tab === "profiles" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{profiles.length} sponsor{profiles.length !== 1 ? "s" : ""}</p>
                {profiles.length > 0 && (
                  <button onClick={() => openEmail("bulk")}
                    className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800">
                    Bulk Email All Sponsors
                  </button>
                )}
              </div>
              {profiles.length === 0 && <p className="text-sm text-gray-400">No sponsors yet.</p>}
              {profiles.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{p.businessName}</p>
                    <p className="text-xs text-gray-500">{p.contactName} · {p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                    {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 hover:underline">{p.website}</a>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEmail(p)}
                      className="text-xs text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 whitespace-nowrap">
                      Email
                    </button>
                    <a href={p.portalUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 whitespace-nowrap">
                      Open Portal ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* NEW BOOKING MODAL */}
          {newBookingDate !== null && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) closeNewBookingModal(); }}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">New Booking</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{newBookingForm.date}</p>
                  </div>
                  <button onClick={closeNewBookingModal} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0">✕</button>
                </div>

                {/* Sponsor selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Select a Sponsor</label>
                  <select
                    value={newBookingForm.profileId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setNewBookingForm((f) => ({ ...f, profileId: pid, headline: "", body: "", ctaUrl: "", ctaLabel: "", imageUrl: "" }));
                      setNewBookingAutoFilled(false);
                    }}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— choose a sponsor —</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.businessName} ({p.contactName})</option>
                    ))}
                  </select>
                </div>

                {/* Autofill from Community Partners listing */}
                {(() => {
                  if (!newBookingForm.profileId) return null;
                  const profile = profiles.find((p) => p.id === newBookingForm.profileId);
                  if (!profile) return null;
                  const listing = spotlights.find((s) => s.sponsor.email === profile.email && s.status === "approved");
                  if (!listing) return null;
                  return (
                    <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                      <p className="text-xs text-green-700">Community Partners listing available</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewBookingForm((f) => ({
                            ...f,
                            headline: `Visit ${listing.businessName}`,
                            body: listing.description,
                            ctaUrl: listing.ctaUrl,
                            ctaLabel: listing.ctaLabel,
                            imageUrl: listing.logoUrl || "",
                          }));
                          setNewBookingAutoFilled(true);
                        }}
                        className="text-xs font-semibold text-green-700 hover:text-green-800"
                      >
                        Auto-fill from listing
                      </button>
                    </div>
                  );
                })()}
                {newBookingAutoFilled && (
                  <p className="text-xs text-green-600">✓ Auto-filled from their Community Partners listing</p>
                )}

                {/* Ad type + date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Type</label>
                    <select
                      value={newBookingForm.type}
                      onChange={(e) => setNewBookingForm((f) => ({ ...f, type: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="in_article">Standard</option>
                      <option value="presenting">Presenting</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Newsletter Date</label>
                    <input
                      type="date"
                      value={newBookingForm.date}
                      onChange={(e) => setNewBookingForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {/* Ad image */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Image URL</label>
                  <UrlInput
                    value={newBookingForm.imageUrl}
                    onChange={(val) => setNewBookingForm((f) => ({ ...f, imageUrl: val }))}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Headline */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Headline</label>
                  <input
                    type="text"
                    value={newBookingForm.headline}
                    onChange={(e) => setNewBookingForm((f) => ({ ...f, headline: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Body Copy</label>
                  <textarea
                    value={newBookingForm.body}
                    rows={4}
                    maxLength={400}
                    onChange={(e) => setNewBookingForm((f) => ({ ...f, body: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>

                {/* CTA */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Label</label>
                    <input
                      type="text"
                      value={newBookingForm.ctaLabel}
                      onChange={(e) => setNewBookingForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CTA Link</label>
                    <UrlInput
                      value={newBookingForm.ctaUrl}
                      onChange={(val) => setNewBookingForm((f) => ({ ...f, ctaUrl: val }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {/* Presenting blurb */}
                {newBookingForm.type === "presenting" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Custom Intro Blurb</label>
                    <textarea
                      value={newBookingForm.presentingBlurb}
                      rows={2}
                      onChange={(e) => setNewBookingForm((f) => ({ ...f, presentingBlurb: e.target.value }))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />
                  </div>
                )}

                {newBookingError && <p className="text-sm text-red-600">{newBookingError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={submitNewBooking}
                    disabled={newBookingSubmitting || !newBookingForm.profileId || !newBookingForm.date || !newBookingForm.headline || !newBookingForm.body || !newBookingForm.ctaUrl || !newBookingForm.ctaLabel}
                    className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                  >
                    {newBookingSubmitting ? "Creating…" : "Create Booking"}
                  </button>
                  <button onClick={closeNewBookingModal} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EMAIL COMPOSE MODAL */}
          {emailTarget !== null && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      {emailTarget === "bulk"
                        ? `Bulk Email — All Sponsors`
                        : `Email ${(emailTarget as Profile).businessName}`}
                    </h2>
                    {emailTarget !== "bulk" && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        To: {(emailTarget as Profile).contactName} &lt;{(emailTarget as Profile).email}&gt;
                      </p>
                    )}
                    {emailTarget === "bulk" && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Will send to {profiles.filter((p) => p.active).length} active sponsors
                      </p>
                    )}
                  </div>
                  <button onClick={closeEmail} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0">✕</button>
                </div>

                {emailTarget === "bulk" && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">Personalisation placeholders:</p>
                    <p className="font-mono">{"{{BUSINESS_NAME}}"} · {"{{CONTACT_NAME}}"} · {"{{PORTAL_URL}}"}</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Subject line…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
                  <textarea
                    rows={10}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder={"Hi {{CONTACT_NAME}},\n\nYour message here.\n\nThanks,\nChad"}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-1">Plain text — blank lines become paragraphs, single line breaks are preserved.</p>
                </div>

                {emailResult && (
                  <p className={`text-sm font-medium ${emailResult.ok ? "text-green-600" : "text-red-600"}`}>
                    {emailResult.message}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={sendSponsorEmail}
                    disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                    className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                  >
                    {emailSending ? "Sending…" : emailTarget === "bulk" ? "Send to All Sponsors" : "Send Email"}
                  </button>
                  <button onClick={closeEmail}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50">
                    {emailResult?.ok ? "Close" : "Cancel"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PRICING */}
          {tab === "pricing" && (
            <div className="max-w-md space-y-6">
              <p className="text-sm text-gray-500">
                Update the prices displayed on the public <a href="/sponsor" target="_blank" className="text-green-700 underline">/sponsor</a> page.
              </p>

              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                {[
                  { key: "sponsorship_price_spotlight", label: "Community Partners", hint: 'e.g. "Free"' },
                  { key: "sponsorship_price_in_article", label: "Standard Sponsorship", hint: 'e.g. "$15/day"' },
                  { key: "sponsorship_price_presenting", label: "Presenting Sponsor", hint: 'e.g. "$25/day"' },
                ].map(({ key, label, hint }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <input
                      type="text"
                      value={prices[key as keyof typeof prices]}
                      onChange={(e) => setPrices((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={hint}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={savePrices}
                  disabled={priceSaving}
                  className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {priceSaving ? "Saving…" : "Save Prices"}
                </button>
                {priceSaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
