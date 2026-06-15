"use client";

import { useEffect, useState } from "react";

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
  approved: "bg-green-50 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  rejected: "bg-red-50 text-red-600",
  completed: "bg-gray-100 text-gray-500",
};

function StatusBadge({ status }: { status: string }) {
  const label = status === "pending_review" ? "Pending Review" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || "bg-gray-100 text-gray-500"}`}>{label}</span>;
}

export default function AdminSponsorsPage() {
  const [tab, setTab] = useState<"spotlights" | "bookings" | "profiles" | "pricing">("spotlights");
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  async function updateBooking(id: string, patch: object) {
    await fetch(`/api/admin/sponsors/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function deleteBooking(id: string) {
    if (!confirm("Delete this booking?")) return;
    await fetch(`/api/admin/sponsors/bookings/${id}`, { method: "DELETE" });
    load();
  }

  const pendingCount = spotlights.filter((s) => s.status === "pending").length + bookings.filter((b) => b.status === "pending_review").length;

  return (
    <div className="p-8">
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* BOOKINGS */}
          {tab === "bookings" && (
            <div className="space-y-3">
              {bookings.length === 0 && <p className="text-sm text-gray-400">No ad bookings yet.</p>}
              {bookings.map((b) => (
                <div key={b.id} className="bg-white rounded-xl border border-gray-200">
                  <div className="p-4 flex items-start gap-4">
                    {b.imageUrl && <img src={b.imageUrl} alt="" className="w-16 h-12 rounded-lg object-cover border border-gray-100 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-gray-800">{b.date}</p>
                        <span className="text-xs text-gray-500 capitalize">{b.type === "in_article" ? "In-Article" : "Presenting"}</span>
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
                        <button onClick={() => deleteBooking(b.id)} className="px-3 py-1.5 text-red-500 hover:text-red-700 text-xs font-semibold">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PROFILES */}
          {tab === "profiles" && (
            <div className="space-y-3">
              {profiles.length === 0 && <p className="text-sm text-gray-400">No sponsors yet.</p>}
              {profiles.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{p.businessName}</p>
                    <p className="text-xs text-gray-500">{p.contactName} · {p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                    {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 hover:underline">{p.website}</a>}
                  </div>
                  <a href={p.portalUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-green-700 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 whitespace-nowrap">
                    Open Portal ↗
                  </a>
                </div>
              ))}
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
                  { key: "sponsorship_price_spotlight", label: "Small Business Spotlight", hint: 'e.g. "Free"' },
                  { key: "sponsorship_price_in_article", label: "In-Article Sponsorship", hint: 'e.g. "$15/day"' },
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
