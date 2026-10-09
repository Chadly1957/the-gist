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
  refreshInterval: string | null;
  active: boolean;
  sortOrder: number;
  contactEmail: string | null;
  onlineRedemption: boolean;
  createdAt: string;
  _count: { redemptions: number };
}

interface Redemption {
  id: string;
  redeemedAt: string;
  coupon: { businessName: string; title: string };
  purchase: { email: string };
}

interface SponsorCoupon {
  id: string;
  businessName: string;
  title: string;
  description: string;
  refreshInterval: string | null;
  maxRedemptions: number | null;
  active: boolean;
  createdAt: string;
  sponsor: { businessName: string } | null;
}

interface SponsorDeal {
  id: string;
  title: string;
  price: string | null;
  summary: string;
  expiresAt: string | null;
  isTopPick: boolean;
  dealWeek: {
    weekStart: string;
    weekEnd: string;
    status: string;
    retailer: { displayName: string };
  };
}

const emptyForm = {
  businessName: "",
  title: "",
  description: "",
  terms: "",
  refreshInterval: "weekly" as "daily" | "weekly" | "monthly",
  contactEmail: "",
  sortOrder: "0",
  onlineRedemption: false,
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [sponsorCoupons, setSponsorCoupons] = useState<SponsorCoupon[]>([]);
  const [sponsorDeals, setSponsorDeals] = useState<SponsorDeal[]>([]);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compEmail, setCompEmail] = useState("");
  const [compSessionId, setCompSessionId] = useState("");
  const [comping, setComping] = useState(false);
  const [compMsg, setCompMsg] = useState<string | null>(null);
  interface Purchase { id: string; email: string; createdAt: string; active: boolean; paid: boolean; magicLink: string; }
  const [buyerQuery, setBuyerQuery] = useState("");
  const [buyers, setBuyers] = useState<Purchase[]>([]);
  const [buyerMsg, setBuyerMsg] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [cRes, rRes, sRes] = await Promise.all([
      workspaceFetch("/api/admin/coupons"),
      workspaceFetch("/api/admin/coupons/redemptions"),
      workspaceFetch("/api/admin/coupons/sponsor-submissions"),
    ]);
    const cData = await cRes.json();
    const rData = await rRes.json();
    const sData = await sRes.json().catch(() => ({}));
    if (cRes.ok) {
      setCoupons(cData.coupons);
      setPurchaseCount(cData.purchaseCount);
    }
    if (rRes.ok) setRedemptions(rData.redemptions);
    if (sRes.ok) {
      setSponsorCoupons(sData.coupons || []);
      setSponsorDeals(sData.deals || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function lookupBuyers() {
    setBuyerMsg(null);
    setBuyers([]);
    try {
      const res = await workspaceFetch(`/api/admin/coupons/purchases?email=${encodeURIComponent(buyerQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed.");
      setBuyers(data.purchases);
      setBuyerMsg(data.purchases.length === 0 ? "No buyers found." : `${data.purchases.length} buyer${data.purchases.length === 1 ? "" : "s"} found.`);
    } catch (err) {
      setBuyerMsg(err instanceof Error ? err.message : "Lookup failed.");
    }
  }

  async function copyBuyerLink(b: Purchase) {
    try {
      await navigator.clipboard.writeText(b.magicLink);
      setCopiedId(b.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setBuyerMsg("Could not copy to clipboard — copy it manually from a resend instead.");
    }
  }

  async function resendBuyerLink(b: Purchase) {
    setResending(b.id);
    setBuyerMsg(null);
    try {
      const res = await workspaceFetch("/api/admin/coupons/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: b.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Resend failed.");
      setBuyerMsg(`Magic link re-sent to ${b.email}.`);
    } catch (err) {
      setBuyerMsg(`Resend failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setResending(null);
    }
  }

  async function compBook(e: React.FormEvent) {
    e.preventDefault();
    if (!compEmail.includes("@")) { setCompMsg("Enter a valid email address."); return; }
    setComping(true);
    setCompMsg(null);
    try {
      const res = await workspaceFetch("/api/admin/coupons/comped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: compEmail.trim(), stripeSessionId: compSessionId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not comp the book.");
      setCompMsg(data.created
        ? `Book ${compSessionId.trim() ? "recorded as paid" : "comped"} for ${data.email}. Magic link emailed.`
        : `${data.email} already had a book — magic link re-sent.`);
      setCompEmail("");
      setCompSessionId("");
      load();
    } catch (err) {
      setCompMsg(err instanceof Error ? err.message : "Could not comp the book.");
    } finally {
      setComping(false);
    }
  }

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
      refreshInterval: form.refreshInterval,
      contactEmail: form.contactEmail,
      sortOrder: Number(form.sortOrder) || 0,
      onlineRedemption: form.onlineRedemption,
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
      refreshInterval: (c.refreshInterval === "daily" || c.refreshInterval === "monthly" ? c.refreshInterval : "weekly") as "daily" | "weekly" | "monthly",
      contactEmail: c.contactEmail || "",
      sortOrder: String(c.sortOrder),
      onlineRedemption: c.onlineRedemption || false,
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
      <h1 className="text-2xl font-bold mb-1">The Gist Deals</h1>
      <p className="text-gray-500 text-sm mb-6">{purchaseCount} book{purchaseCount === 1 ? "" : "s"} sold · {coupons.filter((c) => c.active).length} active coupons</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="font-bold mb-1">Comp a book</h2>
        <p className="text-xs text-gray-500 mb-3">Add someone free of charge — no Stripe. They get full lifetime access and their magic link by email.</p>
        <form onSubmit={compBook} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input type="email" value={compEmail} onChange={(e) => setCompEmail(e.target.value)} placeholder="you@example.com" className="flex-1 border rounded-lg px-3 py-2" />
            <button disabled={comping} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm whitespace-nowrap disabled:opacity-50">{comping ? "Adding…" : "Comp book"}</button>
          </div>
          <input type="text" value={compSessionId} onChange={(e) => setCompSessionId(e.target.value)} placeholder="Stripe session ID (optional — for paid purchases the webhook missed)" className="border rounded-lg px-3 py-2 text-sm text-gray-500" />
        </form>
        {compMsg && <p className="text-xs text-gray-600 mt-2">{compMsg}</p>}
      </div>

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="font-bold mb-1">Buyer lookup</h2>
        <p className="text-xs text-gray-500 mb-3">Find a buyer to copy their personal book link or resend their magic-link email.</p>
        <form
          onSubmit={(e) => { e.preventDefault(); lookupBuyers(); }}
          className="flex gap-2 mb-3"
        >
          <input
            type="text"
            value={buyerQuery}
            onChange={(e) => setBuyerQuery(e.target.value)}
            placeholder="buyer email…"
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm whitespace-nowrap">Search</button>
        </form>
        {buyerMsg && <p className="text-xs text-gray-600 mb-2">{buyerMsg}</p>}
        {buyers.length > 0 && (
          <ul className="divide-y border rounded-lg">
            {buyers.map((b) => (
              <li key={b.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{b.email}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(b.createdAt).toLocaleDateString()} · {b.paid ? "paid" : "comped"}{!b.active && " · inactive"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => copyBuyerLink(b)}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                  >
                    {copiedId === b.id ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    onClick={() => resendBuyerLink(b)}
                    disabled={resending === b.id}
                    className="px-3 py-1.5 text-xs bg-green-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {resending === b.id ? "Sending…" : "Resend email"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
          <div className="md:col-span-2">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.onlineRedemption} onChange={(e) => set("onlineRedemption", e.target.checked)} className="mt-1" />
              <span><span className="font-semibold">Online / email redemption.</span> <span className="text-gray-500">Buyer copies a booking link instead of showing a QR in store (for businesses with no physical location).</span></span>
            </label>
          </div>
          <div className="md:col-span-2 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">Refreshes:</span>
              <div className="inline-flex rounded-lg border overflow-hidden">
                {(["daily", "weekly", "monthly"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set("refreshInterval", opt)}
                    className={`px-3 py-1.5 text-sm capitalize ${form.refreshInterval === opt ? "bg-green-700 text-white font-semibold" : "bg-white text-gray-600"}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
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
                <p className="font-bold">{c.title} <span className="font-normal text-gray-500 text-sm">({c.refreshInterval ? `refreshes ${c.refreshInterval}` : c.maxRedemptions === 1 ? "one-time" : "reusable"}{c.onlineRedemption ? ", online" : ""})</span></p>
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

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="font-bold mb-1">Sponsor portal submissions</h2>
        <p className="text-xs text-gray-500 mb-5">Coupons and deals sponsors created themselves in their sponsor portals.</p>

        <h3 className="text-sm font-semibold mb-2">Coupons ({sponsorCoupons.length})</h3>
        {sponsorCoupons.length === 0 ? (
          <p className="text-gray-500 text-sm mb-6">No sponsor-submitted coupons yet.</p>
        ) : (
          <div className="space-y-3 mb-6">
            {sponsorCoupons.map((c) => (
              <div key={c.id} className={`border rounded-lg p-4 ${c.active ? "" : "opacity-50"}`}>
                <p className="text-xs text-gray-500 uppercase">{c.sponsor?.businessName || c.businessName}</p>
                <p className="font-bold">
                  {c.title}{" "}
                  <span className="font-normal text-gray-500 text-sm">
                    ({c.refreshInterval ? `refreshes ${c.refreshInterval}` : c.maxRedemptions === 1 ? "one-time" : "reusable"})
                  </span>
                </p>
                {c.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Added {new Date(c.createdAt).toLocaleDateString()} · {c.active ? "active" : "inactive"}
                </p>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-sm font-semibold mb-2">Deals ({sponsorDeals.length})</h3>
        {sponsorDeals.length === 0 ? (
          <p className="text-gray-500 text-sm">No sponsor-submitted deals yet.</p>
        ) : (
          <div className="space-y-3">
            {sponsorDeals.map((d) => {
              const expired = d.expiresAt ? new Date(d.expiresAt) < new Date() : false;
              return (
                <div key={d.id} className={`border rounded-lg p-4 ${expired ? "opacity-50" : ""}`}>
                  <p className="text-xs text-gray-500 uppercase">{d.dealWeek.retailer.displayName}</p>
                  <p className="font-bold">
                    {d.title}{" "}
                    {d.price && <span className="font-normal text-green-700 text-sm">{d.price}</span>}{" "}
                    {d.isTopPick && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium">Top pick</span>}
                  </p>
                  {d.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.summary}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Week of {d.dealWeek.weekStart} · {d.expiresAt ? (expired ? `expired ${new Date(d.expiresAt).toLocaleDateString()}` : `expires ${new Date(d.expiresAt).toLocaleDateString()}`) : "no expiry"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
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
