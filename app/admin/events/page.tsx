"use client";

import { useEffect, useState } from "react";
import UrlInput from "@/components/UrlInput";

interface Event {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  url: string | null;
  cost: string | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  sponsor: { businessName: string; contactName: string; email: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-600",
};

function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || "bg-gray-100 text-gray-500"}`}>
      {label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const EMPTY_FORM = { title: "", description: "", eventDate: "", startTime: "", endTime: "", location: "", url: "", cost: "" };

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState("");
  const [scrapeWarnings, setScrapeWarnings] = useState<string[]>([]);
  const [scrapeFound, setScrapeFound] = useState<Record<string, boolean>>({});

  async function load() {
    const res = await fetch("/api/admin/events");
    const data = await res.json();
    setEvents(data.events || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateEvent(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/admin/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    setExpandedId(null);
    await load();
  }

  async function saveEdit(id: string) {
    await updateEvent(id, editForm);
    setEditingId(null);
  }

  async function scrapeEvent() {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setScrapeError("");
    setScrapeWarnings([]);
    setScrapeFound({});
    const res = await fetch("/api/admin/events/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: scrapeUrl.trim() }),
    });
    const data = await res.json();
    setScraping(false);
    if (!res.ok) { setScrapeError(data.error || "Failed to fetch event details."); return; }
    const ev = data.event;
    setAddForm((f) => ({
      ...f,
      title: ev.title ?? f.title,
      description: ev.description ?? f.description,
      eventDate: ev.eventDate ?? f.eventDate,
      startTime: ev.startTime ?? f.startTime,
      endTime: ev.endTime ?? f.endTime,
      location: ev.location ?? f.location,
      url: ev.url ?? f.url,
    }));
    setScrapeFound(ev.found ?? {});
    setScrapeWarnings(ev.warnings ?? []);
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    setAddSaving(true);
    setAddError("");
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    if (!res.ok) { setAddError(data.error || "Failed to add event."); setAddSaving(false); return; }
    setAddForm(EMPTY_FORM);
    setScrapeUrl("");
    setScrapeFound({});
    setScrapeWarnings([]);
    setShowAddForm(false);
    setAddSaving(false);
    await load();
  }

  const filtered = events.filter((e) => filter === "all" || e.status === filter);
  const pendingCount = events.filter((e) => e.status === "pending").length;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-orange-600 mt-1">{pendingCount} event{pendingCount !== 1 ? "s" : ""} pending review</p>
          )}
        </div>
        <button
          onClick={() => { setShowAddForm((v) => !v); setAddError(""); }}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>

      {/* Add Event Form */}
      {showAddForm && (
        <form onSubmit={addEvent} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="text-sm font-bold text-gray-800">New Event</h2>

          {/* URL Import */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-800">Import from URL (optional)</p>
            <div className="flex gap-2">
              <UrlInput
                placeholder="https://www.eventbrite.com/e/... or Facebook event link"
                value={scrapeUrl}
                onChange={(val) => { setScrapeUrl(val); setScrapeError(""); setScrapeWarnings([]); setScrapeFound({}); }}
                className="flex-1 px-3 py-2 border border-blue-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={scrapeEvent}
                disabled={scraping || !scrapeUrl.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
              >
                {scraping ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
                    </svg>
                    Fetching…
                  </span>
                ) : "Fetch Details"}
              </button>
            </div>
            {scrapeError && <p className="text-xs text-red-600">{scrapeError}</p>}
            {Object.keys(scrapeFound).length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-700">Fields filled in:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["title", "eventDate", "startTime", "endTime", "location", "description", "url"] as const).map((field) => (
                    <span key={field}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${scrapeFound[field] ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                      {scrapeFound[field] ? "✓ " : "✗ "}{field === "eventDate" ? "date" : field === "startTime" ? "start time" : field === "endTime" ? "end time" : field}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {scrapeWarnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">{w}</p>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
              <input type="text" required value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
              <input type="date" required value={addForm.eventDate} onChange={(e) => setAddForm((f) => ({ ...f, eventDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Start Time</label>
                <input type="text" placeholder="7:00 PM" value={addForm.startTime} onChange={(e) => setAddForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">End Time</label>
                <input type="text" placeholder="9:00 PM" value={addForm.endTime} onChange={(e) => setAddForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
              <input type="text" value={addForm.location} onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Cost</label>
              <input type="text" placeholder="Free, $10, etc." value={addForm.cost} onChange={(e) => setAddForm((f) => ({ ...f, cost: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <textarea rows={2} value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Link (More Info / Tickets)</label>
              <UrlInput placeholder="https://" value={addForm.url} onChange={(val) => setAddForm((f) => ({ ...f, url: val }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={addSaving}
              className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50">
              {addSaving ? "Adding…" : "Add Event"}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); setAddError(""); setScrapeUrl(""); setScrapeFound({}); setScrapeWarnings([]); }}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(["all", "pending", "approved"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {f}{f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {/* Events list */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          {filter === "pending" ? "No events pending review." : "No events yet. Add one above."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => (
            <div key={ev.id} className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 flex items-start gap-4">
                <div className="text-center shrink-0 w-12">
                  <div className="text-xs font-bold text-green-700 uppercase">
                    {new Date(ev.eventDate + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                  </div>
                  <div className="text-xl font-bold text-gray-900 leading-none">
                    {ev.eventDate.split("-")[2]}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-gray-800">{ev.title}</p>
                    <StatusBadge status={ev.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {[ev.startTime, ev.endTime].filter(Boolean).join(" – ")}
                    {ev.location ? ` · ${ev.location}` : ""}
                    {ev.cost ? ` · ${ev.cost}` : ""}
                  </p>
                  {ev.sponsor && (
                    <p className="text-xs text-gray-400 mt-0.5">Submitted by {ev.sponsor.businessName} ({ev.sponsor.email})</p>
                  )}
                </div>
                <button onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
                  {expandedId === ev.id ? "Close" : "Manage"}
                </button>
              </div>

              {expandedId === ev.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl space-y-3">
                  {editingId === ev.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                          <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                          <input type="date" value={editForm.eventDate} onChange={(e) => setEditForm((f) => ({ ...f, eventDate: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Start</label>
                            <input type="text" value={editForm.startTime} onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">End</label>
                            <input type="text" value={editForm.endTime} onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                          <input type="text" value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Cost</label>
                          <input type="text" value={editForm.cost} onChange={(e) => setEditForm((f) => ({ ...f, cost: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                          <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Link</label>
                          <UrlInput value={editForm.url} onChange={(val) => setEditForm((f) => ({ ...f, url: val }))}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(ev.id)}
                          className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800">
                          Save Changes
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p><strong>Date:</strong> {formatDate(ev.eventDate)}</p>
                        {(ev.startTime || ev.endTime) && (
                          <p><strong>Time:</strong> {[ev.startTime, ev.endTime].filter(Boolean).join(" – ")}</p>
                        )}
                        {ev.location && <p><strong>Location:</strong> {ev.location}</p>}
                        {ev.cost && <p><strong>Cost:</strong> {ev.cost}</p>}
                        {ev.description && <p><strong>Description:</strong> {ev.description}</p>}
                        {ev.url && <p><strong>Link:</strong> <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-green-700 underline">{ev.url}</a></p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ev.status === "pending" && (
                          <button onClick={() => updateEvent(ev.id, { status: "approved" })}
                            className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800">
                            Approve
                          </button>
                        )}
                        {ev.status === "pending" && (
                          <button onClick={() => updateEvent(ev.id, { status: "rejected" })}
                            className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                            Reject
                          </button>
                        )}
                        {ev.status === "rejected" && (
                          <button onClick={() => updateEvent(ev.id, { status: "approved" })}
                            className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800">
                            Approve
                          </button>
                        )}
                        <button onClick={() => {
                          setEditingId(ev.id);
                          setEditForm({
                            title: ev.title,
                            description: ev.description || "",
                            eventDate: ev.eventDate,
                            startTime: ev.startTime || "",
                            endTime: ev.endTime || "",
                            location: ev.location || "",
                            url: ev.url || "",
                            cost: ev.cost || "",
                          });
                        }} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100">
                          Edit
                        </button>
                        <button onClick={() => deleteEvent(ev.id)}
                          className="px-3 py-1.5 text-red-500 hover:text-red-700 text-xs font-semibold">
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
