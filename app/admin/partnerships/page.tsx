"use client";

import { useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";

const CATEGORIES = ["dining", "banking", "auto", "healthcare", "home_services", "retail"];
const TIERS = [
  { value: "one_city", label: "One city — $333.33/mo ($4,000/yr)" },
  { value: "both_cities", label: "Both cities — $583.33/mo ($7,000/yr)" },
];
const CITIES = [
  { value: "decatur", label: "Decatur" },
  { value: "effingham", label: "Effingham" },
];

interface Partnership {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  category: string;
  tier: string;
  workspaceIds: string[];
  monthlyAmountCents: number;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  past_due: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function PartnershipsPage() {
  const [list, setList] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    category: "dining",
    tier: "one_city",
    workspaceIds: ["decatur"] as string[],
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await workspaceFetch("/api/admin/partnerships");
      const data = await res.json();
      setList(data.partnerships || []);
    } catch {
      setError("Failed to load partnerships.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleCity = (city: string) => {
    setForm((f) => ({
      ...f,
      workspaceIds: f.workspaceIds.includes(city)
        ? f.workspaceIds.filter((c) => c !== city)
        : [...f.workspaceIds, city],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const res = await workspaceFetch("/api/admin/partnerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create partnership.");
      setSuccess(`Invoice sent to ${data.invoiceSentTo}. They just click and pay.`);
      setShowForm(false);
      setForm({ businessName: "", contactName: "", email: "", category: "dining", tier: "one_city", workspaceIds: ["decatur"], notes: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create partnership.");
    }
    setSending(false);
  };

  const cancel = async (id: string, businessName: string) => {
    if (!confirm(`Cancel ${businessName}'s partnership? Their Stripe subscription will be cancelled with proration.`)) return;
    try {
      const res = await workspaceFetch(`/api/admin/partnerships/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancel failed.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed.");
    }
  };

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Presenting Partnerships</h1>
          <p className="text-sm text-gray-500 mt-1">
            One partner per category per city. Fill in the details, hit send, Stripe emails them the invoice.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {showForm ? "Close" : "+ New Partnership"}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={submit} className="mb-8 p-5 border rounded-xl bg-gray-50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Business name</span>
              <input
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Chad Bowlin Ford"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Contact name</span>
              <input
                required
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Chad Bowlin"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email (invoice goes here)</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="chad@example.com"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium">Tier</span>
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              >
                {TIERS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className="text-sm font-medium">Cities</span>
            <div className="mt-1 flex gap-3">
              {CITIES.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.workspaceIds.includes(c.value)}
                    onChange={() => toggleCity(c.value)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Notes (optional)</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              rows={2}
            />
          </label>
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {sending ? "Sending invoice..." : "Create & Send Invoice"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : list.length === 0 ? (
        <p className="text-gray-500">No partnerships yet. Chad Bowlin could be the first.</p>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <div key={p.id} className="p-4 border rounded-xl flex items-center justify-between">
              <div>
                <div className="font-semibold">{p.businessName}</div>
                <div className="text-sm text-gray-500">
                  {p.contactName} · {p.email} · {p.category.replace("_", " ")} · {p.workspaceIds.join(", ")}
                </div>
                <div className="text-sm text-gray-500">{money(p.monthlyAmountCents)}/mo</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>
                  {p.status.replace("_", " ")}
                </span>
                {p.status !== "cancelled" && (
                  <button
                    onClick={() => cancel(p.id, p.businessName)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
