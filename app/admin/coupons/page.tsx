"use client";

import { useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";

interface Coupon {
  id: string;
  businessName: string;
  title: string;
  description: string;
  terms: string;
  maxRedemptions: number | null;
  active: boolean;
  sortOrder: number;
  contactEmail: string | null;
  createdAt: string;
  _count: { redemptions: number };
}

interface Redemption {
  id: string;
  redeemedAt: string;
  coupon: { businessName: string; title: string };
  purchase: { email: string };
}

const emptyForm = {
  businessName: "",
  title: "",
  description: "",
  terms: "",
  oneTime: true,
  contactEmail: "",
  sortOrder: "0",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [cRes, rRes] = await Promise.all([workspaceFetch("/api/admin/coupons"), workspaceFetch("/api/admin/coupons/redemptions")]);
    const cData = await cRes.json();
    const rData = await rRes.json();
    if (cRes.ok) {
      setCoupons(cData.coupons);
      setPurchaseCount(cData.purchaseCount);
    }
    if (rRes.ok) setRedemptions(rData.redemptions);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function set<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = {
      businessName: form.businessName,
      title: form.title,
      description: form.description,
      terms: form.terms,
      maxRedemptions: form.oneTime ? 1 : null,
      contactEmail: form.contactEmail,
      sortOrder: Number(form.sortOrder) || 0,
    };
    const res = await workspaceFetch(editingId ? `/api/admin/coupons/${editingId}` : "/api/admin/coupons", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed.");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  function startEdit(c: Coupon) {
    setEditingId(c.id);
    setForm({
      businessName: c.businessName,
      title: c.title,
      description: c.description,
      terms: c.terms,
      oneTime: c.maxRedemptions === 1,
      contactEmail: c.contactEmail || "",
      sortOrder: String(c.sortOrder),
    });
    window.scrollTo({ top: 0 });
  }

  async function toggleActive(c: Coupon) {
    await workspaceFetch(`/api/admin/coupons/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    load();
  }

  async function remove(c: Coupon) {
    if (!confirm(`Delete "${c.title}"?${c._count.redemptions > 0 ? " It has redemptions, so it will be deactivated instead." : ""}`)) return;
    await workspaceFetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="p-8"><p className="text-gray-500">Loading…</p></div>;

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Coupon Book</h1>
      <p className="text-gray-500 text-sm mb-6">{purchaseCount} book{purchaseCount === 1 ? "" : "s"} sold · {coupons.filter((c) => c.active).length} active coupons</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="font-bold mb-4">{editingId ? "Edit coupon" : "Add a coupon"}</h2>
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Business name</label>
            <input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Title (the offer)</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="10% off your purchase" className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1">Description</label>
            <input value={form.description} onChange={(e) => set("description", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1">Fine print</label>
            <input value={form.terms} onChange={(e) => set("terms", e.target.value)} placeholder="One per visit. Expires…" className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Contact email (redemption alerts)</label>
            <input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Sort order</label>
            <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="md:col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.oneTime} onChange={(e) => set("oneTime", e.target.checked)} />
              One-time use (unchecked = reusable)
            </label>
            <button type="submit" className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold">
              {editingId ? "Save changes" : "Add coupon"}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="text-sm text-gray-500 underline">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="font-bold mb-4">Coupons</h2>
        <div className="space-y-3">
          {coupons.map((c) => (
            <div key={c.id} className={`border rounded-lg p-4 flex items-start justify-between gap-4 ${c.active ? "" : "opacity-50"}`}>
              <div>
                <p className="text-xs text-gray-500 uppercase">{c.businessName}</p>
                <p className="font-bold">{c.title} <span className="font-normal text-gray-500 text-sm">({c.maxRedemptions === 1 ? "one-time" : "reusable"})</span></p>
                <p className="text-xs text-gray-500 mt-1">{c._count.redemptions} redemptions</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(c)} className="text-sm px-3 py-1 border rounded-lg">Edit</button>
                <button onClick={() => toggleActive(c)} className="text-sm px-3 py-1 border rounded-lg">{c.active ? "Deactivate" : "Activate"}</button>
                <button onClick={() => remove(c)} className="text-sm px-3 py-1 border border-red-200 text-red-600 rounded-lg">Delete</button>
              </div>
            </div>
          ))}
          {coupons.length === 0 && <p className="text-gray-500 text-sm">No coupons yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="font-bold mb-4">Recent redemptions</h2>
        {redemptions.length === 0 ? (
          <p className="text-gray-500 text-sm">No redemptions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">When</th>
                <th>Coupon</th>
                <th>Business</th>
                <th>Buyer</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 text-gray-500">{new Date(r.redeemedAt).toLocaleString()}</td>
                  <td>{r.coupon.title}</td>
                  <td>{r.coupon.businessName}</td>
                  <td className="text-gray-500">{r.purchase.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
