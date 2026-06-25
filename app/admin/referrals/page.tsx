"use client";

import { useState, useEffect, useCallback } from "react";

interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goal: number;
  prizeDescription?: string | null;
  status: string;
  winnerEmail?: string | null;
  drawnAt?: string | null;
  createdAt: string;
  totalSignups: number;
  qualifiedReferrers: number;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};

export default function ReferralsPage() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [drawResult, setDrawResult] = useState<{ sprintId: string; winner: { email: string; firstName?: string | null; signupCount: number }; totalEligible: number } | null>(null);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    name: "",
    startDate: today,
    endDate: "",
    goal: "10",
    prizeDescription: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/referrals");
      const data = await res.json();
      if (res.ok) setSprints(data.sprints);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, goal: parseInt(form.goal) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create sprint."); return; }
      setShowForm(false);
      setForm({ name: "", startDate: today, endDate: "", goal: "10", prizeDescription: "" });
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/admin/referrals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sprint? This cannot be undone.")) return;
    await fetch(`/api/admin/referrals/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleDraw(sprint: Sprint) {
    if (!confirm(`Draw a random winner from ${sprint.qualifiedReferrers} qualified referrer${sprint.qualifiedReferrers !== 1 ? "s" : ""}?`)) return;
    setDrawingId(sprint.id);
    try {
      const res = await fetch(`/api/admin/referrals/${sprint.id}/draw`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Could not draw winner."); return; }
      setDrawResult({ sprintId: sprint.id, winner: data.winner, totalEligible: data.totalEligible });
      await load();
    } finally {
      setDrawingId(null);
    }
  }

  const activeSprints = sprints.filter((s) => s.status === "active");
  const pastSprints = sprints.filter((s) => s.status !== "active");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage referral sprints and track reader-driven growth</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Sprint
        </button>
      </div>

      {/* Create sprint form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Create New Sprint</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Sprint Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Summer Referral Challenge"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Referral Goal (per subscriber)</label>
                <input
                  type="number"
                  min="1"
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Prize Description</label>
                <input
                  type="text"
                  value={form.prizeDescription}
                  onChange={(e) => setForm({ ...form, prizeDescription: e.target.value })}
                  placeholder="$25 gift card to a local restaurant"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
              >
                {creating ? "Creating…" : "Create Sprint"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(""); }}
                className="px-5 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Draw result banner */}
      {drawResult && (
        <div className="bg-green-50 border border-green-300 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-900">Winner Drawn!</p>
            <p className="text-sm text-green-800">
              <strong>{drawResult.winner.firstName ? `${drawResult.winner.firstName} (${drawResult.winner.email})` : drawResult.winner.email}</strong> was randomly selected from {drawResult.totalEligible} qualified referrer{drawResult.totalEligible !== 1 ? "s" : ""}.
              They referred <strong>{drawResult.winner.signupCount}</strong> new subscribers.
            </p>
            <button
              onClick={() => setDrawResult(null)}
              className="text-xs text-green-600 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : sprints.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">No referral sprints yet. Create one to get started.</p>
        </div>
      ) : (
        <>
          {activeSprints.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Active</h2>
              <div className="space-y-4">
                {activeSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onDraw={handleDraw}
                    drawing={drawingId === sprint.id}
                  />
                ))}
              </div>
            </div>
          )}
          {pastSprints.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Past Sprints</h2>
              <div className="space-y-4">
                {pastSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onDraw={handleDraw}
                    drawing={drawingId === sprint.id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SprintCard({
  sprint,
  onStatusChange,
  onDelete,
  onDraw,
  drawing,
}: {
  sprint: Sprint;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onDraw: (sprint: Sprint) => void;
  drawing: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const isEnded = sprint.endDate < today;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[sprint.status] ?? "bg-gray-100 text-gray-600"}`}>
              {sprint.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
            {isEnded && sprint.status === "active" && (
              <span className="ml-2 text-amber-600 font-medium">Ended — draw winner or close</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sprint.status === "active" && sprint.qualifiedReferrers > 0 && (
            <button
              onClick={() => onDraw(sprint)}
              disabled={drawing}
              className="flex items-center gap-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {drawing ? "Drawing…" : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Draw Winner
                </>
              )}
            </button>
          )}
          {sprint.status === "active" && (
            <button
              onClick={() => onStatusChange(sprint.id, "cancelled")}
              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onDelete(sprint.id)}
            className="text-xs text-gray-400 hover:text-red-500 px-2 py-1.5 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{sprint.totalSignups}</div>
          <div className="text-xs text-gray-500">Total signups</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{sprint.qualifiedReferrers}</div>
          <div className="text-xs text-gray-500">Met goal ({sprint.goal})</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-gray-900">{sprint.goal}</div>
          <div className="text-xs text-gray-500">Goal / referrer</div>
        </div>
      </div>

      {/* Prize */}
      {sprint.prizeDescription && (
        <p className="text-xs text-gray-500 mb-2">
          <span className="font-semibold">Prize:</span> {sprint.prizeDescription}
        </p>
      )}
      {/* Winner */}
      {sprint.winnerEmail && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-green-900">Winner: {sprint.winnerEmail}</p>
            {sprint.drawnAt && (
              <p className="text-xs text-green-700">Drawn {new Date(sprint.drawnAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
