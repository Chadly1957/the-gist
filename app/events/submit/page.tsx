"use client";

import { useState } from "react";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";
import BoardBoostPrompt from "@/components/BoardBoostPrompt";

// Public event submission: the same flow as the sponsor portal's event
// form, minus the sponsor login. Submissions are pending until an admin
// approves them, and the poster gets the same optional $5 Board boost.
export default function PublicEventSubmitPage() {
  const [form, setForm] = useState({ title: "", description: "", eventDate: "", startTime: "", endTime: "", location: "", url: "", cost: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [boost, setBoost] = useState<null | { title: string; description: string; url: string }>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.eventDate) {
      setError("Title and date are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/events/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Submission failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setBoost({ title: form.title, description: form.description, url: form.url });
      setSuccess(true);
      setForm({ title: "", description: "", eventDate: "", startTime: "", endTime: "", location: "", url: "", cost: "" });
    } catch {
      setError("Connection error. Please try again.");
    }
    setSubmitting(false);
  }

  const inputCls =
    "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-10 sm:py-14 w-full">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2">Submit an Event</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Free. Events are reviewed before they run in the newsletter calendar, so
              allow a day or two for approval.
            </p>
          </div>

          {success && boost ? (
            <BoardBoostPrompt
              title={boost.title}
              description={boost.description}
              linkUrl={boost.url}
              onDecline={() => setBoost(null)}
            />
          ) : success ? (
            <div className="bg-green-50 border border-green-100 rounded-xl p-6 text-center">
              <p className="text-green-800 font-semibold mb-1">Event submitted for review!</p>
              <p className="text-sm text-green-600">We&apos;ll review it and include it in an upcoming newsletter calendar.</p>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={() => setSuccess(false)} className="text-sm text-green-700 underline">Submit another event</button>
                <Link href="/board" className="text-sm text-gray-500 underline">Back to the Board</Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="event-title" className="block text-xs font-semibold text-gray-600 mb-1">Event Name *</label>
                <input
                  id="event-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Decatur Farmers Market"
                  maxLength={120}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="event-date" className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
                  <input
                    id="event-date"
                    type="date"
                    required
                    value={form.eventDate}
                    onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="event-start" className="block text-xs font-semibold text-gray-600 mb-1">Start Time</label>
                    <input
                      id="event-start"
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      placeholder="7:00 PM"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="event-end" className="block text-xs font-semibold text-gray-600 mb-1">End Time</label>
                    <input
                      id="event-end"
                      value={form.endTime}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                      placeholder="9:00 PM"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="event-location" className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                  <input
                    id="event-location"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Address or venue name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="event-cost" className="block text-xs font-semibold text-gray-600 mb-1">Cost</label>
                  <input
                    id="event-cost"
                    value={form.cost}
                    onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                    placeholder="Free, $10, etc."
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="event-description" className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
                <textarea
                  id="event-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="1-2 sentences about the event."
                  maxLength={500}
                  rows={3}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="event-link" className="block text-xs font-semibold text-gray-600 mb-1">Link <span className="font-normal text-gray-400">(more info / tickets, optional)</span></label>
                <input
                  id="event-link"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://…"
                  className={inputCls}
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors"
              >
                {submitting ? "Submitting…" : "Submit Event for Review"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Free to submit. After approval it runs in the newsletter calendar, and you can
                optionally add it to the Gist Board for $5.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
