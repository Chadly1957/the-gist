"use client";

import { useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";

interface Retailer {
  id: string;
  slug: string;
  displayName: string;
  pipeline: string;
  storeConfig: string;
  logoUrl: string | null;
  affiliateUrlTemplate: string | null;
  active: boolean;
  dealWeeks: Array<{ id: string; weekStart: string; status: string; _count: { deals: number } }>;
}

interface DealWeek {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  retailer: { displayName: string; slug: string; pipeline: string };
  _count: { deals: number };
}

interface Deal {
  id: string;
  title: string;
  price: string | null;
  regPrice: string | null;
  category: string | null;
  summary: string;
  dealUrl: string | null;
  businessName: string | null;
  validFrom: string | null;
  validTo: string | null;
  isTopPick: boolean;
  sortOrder: number;
}

interface WeekDetail {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  retailer: { displayName: string; slug: string; pipeline: string };
  deals: Deal[];
}

const emptyManual = {
  retailerSlug: "business-deals",
  businessName: "",
  title: "",
  price: "",
  category: "",
  summary: "",
  dealUrl: "",
  validFrom: "",
  validTo: "",
  isTopPick: false,
};

export default function AdminDealsPage() {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [weeks, setWeeks] = useState<DealWeek[]>([]);
  const [review, setReview] = useState<WeekDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Array<{ displayName: string; ok: boolean; dealCount?: number; error?: string }>>([]);
  const [manual, setManual] = useState(emptyManual);
  const [manualMsg, setManualMsg] = useState("");
  const [businesses, setBusinesses] = useState<Array<{ name: string; hasPortal: boolean }>>([]);
  const [bizOpen, setBizOpen] = useState(false);
  const [referrals, setReferrals] = useState({ deals_referral_rakuten: "", deals_referral_ibotta: "", deals_referral_note: "" });
  const [digest, setDigest] = useState<any>(null);
  const [editingRetailer, setEditingRetailer] = useState<Retailer | null>(null);
  const [cfgText, setCfgText] = useState("");

  async function load() {
    setLoading(true);
    const [rRes, wRes, refRes, dRes, bRes] = await Promise.all([
      workspaceFetch("/api/admin/deals/retailers"),
      workspaceFetch("/api/admin/deals/weeks"),
      workspaceFetch("/api/admin/deals/referrals"),
      workspaceFetch("/api/admin/deals/send-digest"),
      workspaceFetch("/api/admin/deals/businesses"),
    ]);
    if (rRes.ok) setRetailers((await rRes.json()).retailers);
    if (bRes.ok) setBusinesses((await bRes.json()).businesses);
    if (wRes.ok) setWeeks((await wRes.json()).weeks);
    if (refRes.ok) setReferrals((await refRes.json()).referrals);
    if (dRes.ok) setDigest(await dRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function seed() {
    const res = await workspaceFetch("/api/admin/deals/seed", { method: "POST" });
    const data = await res.json();
    alert(res.ok ? `Seeded: ${data.created} created, ${data.kept} already there.` : data.error);
    load();
  }

  async function refresh(retailerId?: string) {
    setRefreshing(retailerId || "all");
    setOutcomes([]);
    try {
      const res = await workspaceFetch("/api/admin/deals/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retailerId ? { retailerId } : {}),
      });
      const data = await res.json();
      setOutcomes(data.outcomes || [{ displayName: "refresh", ok: false, error: data.error }]);
    } catch (e) {
      setOutcomes([{ displayName: "refresh", ok: false, error: String(e) }]);
    }
    setRefreshing(null);
    load();
  }

  async function openReview(id: string) {
    const res = await workspaceFetch(`/api/admin/deals/weeks/${id}`);
    if (res.ok) setReview((await res.json()).week);
  }

  async function setStatus(id: string, status: string) {
    const res = await workspaceFetch(`/api/admin/deals/weeks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { openReview(id); load(); }
  }

  async function toggleTopPick(deal: Deal) {
    await workspaceFetch(`/api/admin/deals/deals/${deal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTopPick: !deal.isTopPick }),
    });
    if (review) openReview(review.id);
  }

  async function deleteDeal(id: string) {
    if (!confirm("Delete this deal?")) return;
    await workspaceFetch(`/api/admin/deals/deals/${id}`, { method: "DELETE" });
    if (review) openReview(review.id);
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setManualMsg("");
    const res = await workspaceFetch("/api/admin/deals/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manual),
    });
    const data = await res.json();
    if (res.ok) {
      setManualMsg("Deal added — live in the book now.");
      setManual({ ...emptyManual, retailerSlug: manual.retailerSlug });
      load();
    } else {
      setManualMsg(`Error: ${data.error}`);
    }
  }

  async function saveReferrals() {
    const res = await workspaceFetch("/api/admin/deals/referrals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(referrals),
    });
    alert(res.ok ? "Referral links saved." : "Failed to save.");
  }

  async function sendDigest() {
    if (!confirm(`Send the weekly digest to ${digest?.buyerCount || 0} buyers?`)) return;
    const res = await workspaceFetch("/api/admin/deals/send-digest", { method: "POST" });
    const data = await res.json();
    if (!res.ok) { alert(`Error: ${data.error || "Failed to send."}`); return; }
    if (data.skipped) { alert(`Not sent: ${data.skipped}`); return; }
    alert(`Sent to ${data.sent} buyers (${data.failed} failed).`);
    load();
  }

  const [testEmail, setTestEmail] = useState("");
  async function sendTestDigest() {
    if (!testEmail.includes("@")) { alert("Enter a valid email address."); return; }
    const res = await workspaceFetch("/api/admin/deals/send-digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testEmail: testEmail.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { alert(`Error: ${data.error || "Failed to send."}`); return; }
    if (data.skipped) { alert(`Not sent: ${data.skipped}`); return; }
    if (data.failed) { alert(`The test email failed to send. Check the email configuration.`); return; }
    alert(`Test email sent to ${testEmail.trim()}.`);
  }

  const [logoText, setLogoText] = useState("");
  function openCfg(r: Retailer) {
    setEditingRetailer(r);
    setCfgText(r.storeConfig);
    setLogoText(r.logoUrl || "");
  }

  async function saveCfg() {
    if (!editingRetailer) return;
    const res = await workspaceFetch("/api/admin/deals/retailers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingRetailer.id, storeConfig: cfgText, logoUrl: logoText.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    setEditingRetailer(null);
    load();
  }

  const manualRetailers = retailers.filter((r) => r.pipeline === "manual");

  async function toggleRetailer(r: Retailer) {
    const res = await workspaceFetch("/api/admin/deals/retailers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, active: !r.active }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    load();
  }

  if (loading) return <div className="p-8"><p className="text-gray-500">Loading deals…</p></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">The Gist Deals</h1>
        <div className="space-x-2">
          <button onClick={seed} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">Seed retailers</button>
          <button
            onClick={() => refresh()}
            disabled={refreshing !== null}
            className="px-3 py-2 text-sm bg-green-700 text-white rounded-lg disabled:opacity-50"
          >
            {refreshing === "all" ? "Refreshing…" : "Refresh all (fetch weekly ads)"}
          </button>
        </div>
      </div>

      {outcomes.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <p className="font-bold text-sm mb-2">Refresh results</p>
          {outcomes.map((o, i) => (
            <p key={i} className={`text-sm ${o.ok ? "text-green-700" : "text-red-700"}`}>
              {o.ok ? "✓" : "✗"} {o.displayName}
              {o.ok && o.dealCount !== undefined ? ` — ${o.dealCount} deals` : ""}
              {!o.ok && o.error ? ` — ${o.error}` : ""}
            </p>
          ))}
        </div>
      )}

      {/* Retailers */}
      <section>
        <h2 className="text-lg font-bold mb-2">Retailers & pipelines</h2>
        <div className="bg-white border rounded-xl divide-y">
          {retailers.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">
                  {r.displayName}
                  <span className="ml-2 text-xs text-gray-400 font-normal">{r.pipeline}</span>
                  {!r.active && <span className="ml-2 text-xs text-red-600">disabled</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {r.dealWeeks[0]
                    ? `Latest: week of ${r.dealWeeks[0].weekStart} · ${r.dealWeeks[0]._count.deals} deals · ${r.dealWeeks[0].status}`
                    : "No fetches yet"}
                </p>
                {r.slug === "dollar-general" && (
                  <p className="text-xs text-amber-700 mt-1">Needs one-time flyerkit token — paste it in settings below.</p>
                )}
                {r.slug === "kroger" && (
                  <p className="text-xs text-amber-700 mt-1">Needs free API key at developer.kroger.com (KROGER_CLIENT_ID / KROGER_CLIENT_SECRET env).</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openCfg(r)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Settings</button>
                <button
                  onClick={() => toggleRetailer(r)}
                  title={r.active ? "Hide this retailer from the deals book" : "Show this retailer in the deals book"}
                  className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                >
                  {r.active ? "Hide" : "Show"}
                </button>
                {r.pipeline !== "manual" && (
                  <button
                    onClick={() => refresh(r.id)}
                    disabled={refreshing !== null}
                    className="px-2 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-50"
                  >
                    {refreshing === r.id ? "…" : "Refresh"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {retailers.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No retailers yet — hit “Seed retailers” above.</p>
          )}
        </div>
        {editingRetailer && (
          <div className="mt-3 bg-white border rounded-xl p-4">
            <p className="font-bold text-sm mb-2">Settings: {editingRetailer.displayName}</p>
            <p className="text-xs text-gray-500 mb-1">
              storeConfig JSON — keys: zip, storeId (Target), storeCode (Aldi/DG), token + merchant (DG flyerkit), locationId (Kroger).
            </p>
            <textarea
              value={cfgText}
              onChange={(e) => setCfgText(e.target.value)}
              rows={4}
              className="w-full border rounded-lg p-2 font-mono text-xs mb-2"
            />
            <p className="text-xs text-gray-500 mb-1">Brand logo URL (shown in the Deals Book; blank = none).</p>
            <input
              value={logoText}
              onChange={(e) => setLogoText(e.target.value)}
              placeholder="https://…"
              className="w-full border rounded-lg p-2 text-xs mb-2"
            />
            <div className="flex gap-2">
              <button onClick={saveCfg} className="px-3 py-1 text-sm bg-green-700 text-white rounded-lg">Save</button>
              <button onClick={() => setEditingRetailer(null)} className="px-3 py-1 text-sm border rounded-lg">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {/* Weeks */}
      <section>
        <h2 className="text-lg font-bold mb-2">Deal weeks (review → publish)</h2>
        <div className="bg-white border rounded-xl divide-y">
          {weeks.map((w) => (
            <div key={w.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {w.retailer.displayName} <span className="text-gray-400 font-normal">· week of {w.weekStart}</span>
                </p>
                <p className="text-xs text-gray-500">{w._count.deals} deals</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${w.status === "published" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                  {w.status}
                </span>
                <button onClick={() => openReview(w.id)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Review</button>
              </div>
            </div>
          ))}
          {weeks.length === 0 && <p className="p-4 text-sm text-gray-500">No weeks yet — refresh a retailer above.</p>}
        </div>

        {review && (
          <div className="mt-4 bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold">
                {review.retailer.displayName} · week of {review.weekStart}
                <span className="ml-2 text-xs font-normal text-gray-500">{review.deals.length} deals</span>
              </p>
              <div className="flex gap-2">
                {review.status === "draft" ? (
                  <button onClick={() => setStatus(review.id, "published")} className="px-3 py-1 text-sm bg-green-700 text-white rounded-lg">Publish</button>
                ) : (
                  <button onClick={() => setStatus(review.id, "draft")} className="px-3 py-1 text-sm border rounded-lg">Unpublish</button>
                )}
                <button onClick={() => setReview(null)} className="px-3 py-1 text-sm border rounded-lg">Close</button>
              </div>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto border rounded-lg">
              {review.deals.map((d) => (
                <div key={d.id} className="p-2 flex items-start gap-2 text-sm">
                  <button
                    onClick={() => toggleTopPick(d)}
                    title="Toggle Top 10 pick"
                    className={`shrink-0 mt-0.5 ${d.isTopPick ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}`}
                  >
                    ★
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {d.businessName && <span className="text-gray-500 font-normal">{d.businessName}: </span>}
                      {d.title}
                      {d.price && <span className="font-bold"> {d.price}</span>}
                    </p>
                    {d.summary && <p className="text-xs text-gray-500 truncate">{d.summary}</p>}
                  </div>
                  <button onClick={() => deleteDeal(d.id)} className="text-xs text-red-600 hover:underline shrink-0">Delete</button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">★ marks Top 10 picks — they show first in the book and the digest.</p>
          </div>
        )}
      </section>

      {/* Manual entry */}
      <section>
        <h2 className="text-lg font-bold mb-2">Add a deal by hand</h2>
        <p className="text-xs text-gray-500 mb-3">
          Any business you find, whenever you find it — no weekly obligation. Goes live in the book immediately.
        </p>
        <form onSubmit={submitManual} className="bg-white border rounded-xl p-4 grid grid-cols-2 gap-3">
          <label className="text-sm">Bucket
            <select value={manual.retailerSlug} onChange={(e) => setManual({ ...manual, retailerSlug: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm">
              {manualRetailers.map((r) => <option key={r.slug} value={r.slug}>{r.displayName}</option>)}
            </select>
          </label>
          <label className="text-sm relative">Business name
            <input
              value={manual.businessName}
              onChange={(e) => { setManual({ ...manual, businessName: e.target.value }); setBizOpen(true); }}
              onFocus={() => setBizOpen(true)}
              onBlur={() => setTimeout(() => setBizOpen(false), 150)}
              className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm"
              placeholder="Joe's Pizza"
              autoComplete="off"
            />
            {bizOpen && manual.businessName.trim().length > 0 && (() => {
              const q = manual.businessName.trim().toLowerCase();
              const matches = businesses.filter((b) => b.name.toLowerCase().includes(q) && b.name.toLowerCase() !== q).slice(0, 8);
              if (!matches.length) return null;
              return (
                <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {matches.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setManual({ ...manual, businessName: b.name }); setBizOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                    >
                      <span>{b.name}</span>
                      {b.hasPortal && <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">PORTAL</span>}
                    </button>
                  ))}
                </div>
              );
            })()}
            {(() => {
              const q = manual.businessName.trim().toLowerCase();
              const exact = businesses.find((b) => b.name.toLowerCase() === q);
              if (exact?.hasPortal) {
                return <p className="text-[11px] text-green-700 mt-1">This business has a sponsor portal.</p>;
              }
              return null;
            })()}
          </label>
          <label className="text-sm col-span-2">Deal title *
            <input required value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="2-for-1 large pizzas" />
          </label>
          <label className="text-sm">Price
            <input value={manual.price} onChange={(e) => setManual({ ...manual, price: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="$12.99" />
          </label>
          <label className="text-sm">Category
            <input value={manual.category} onChange={(e) => setManual({ ...manual, category: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="Food" />
          </label>
          <label className="text-sm col-span-2">Details
            <textarea value={manual.summary} onChange={(e) => setManual({ ...manual, summary: e.target.value })} rows={2} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="Dine-in only, limit 2…" />
          </label>
          <label className="text-sm col-span-2">Link
            <input value={manual.dealUrl} onChange={(e) => setManual({ ...manual, dealUrl: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="https://…" />
          </label>
          <label className="text-sm">Valid from
            <input type="date" value={manual.validFrom} onChange={(e) => setManual({ ...manual, validFrom: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm">Valid to
            <input type="date" value={manual.validTo} onChange={(e) => setManual({ ...manual, validTo: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
          </label>
          <label className="text-sm col-span-2 flex items-center gap-2">
            <input type="checkbox" checked={manual.isTopPick} onChange={(e) => setManual({ ...manual, isTopPick: e.target.checked })} />
            Top 10 pick
          </label>
          <div className="col-span-2">
            <button type="submit" className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm">Add deal</button>
            {manualMsg && <p className="text-sm mt-2 text-gray-600">{manualMsg}</p>}
          </div>
        </form>
      </section>

      {/* Referrals */}
      <section>
        <h2 className="text-lg font-bold mb-2">Referral wallet</h2>
        <div className="bg-white border rounded-xl p-4 grid gap-3">
          <label className="text-sm">Rakuten referral link
            <input value={referrals.deals_referral_rakuten} onChange={(e) => setReferrals({ ...referrals, deals_referral_rakuten: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="https://www.rakuten.com/r/…" />
          </label>
          <label className="text-sm">Ibotta referral link
            <input value={referrals.deals_referral_ibotta} onChange={(e) => setReferrals({ ...referrals, deals_referral_ibotta: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="https://ibotta.com/…" />
          </label>
          <label className="text-sm">Blurb
            <input value={referrals.deals_referral_note} onChange={(e) => setReferrals({ ...referrals, deals_referral_note: e.target.value })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="Stack cashback on top of these deals…" />
          </label>
          <div><button onClick={saveReferrals} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm">Save referral links</button></div>
        </div>
      </section>

      {/* Digest */}
      <section>
        <h2 className="text-lg font-bold mb-2">Weekly buyer digest</h2>
        <div className="bg-white border rounded-xl p-4">
          {digest ? (
            <>
              <p className="text-sm text-gray-600">
                Buyers on the list: <strong>{digest.buyerCount}</strong> ·
                Published deals ready: <strong>{digest.dealCount}</strong> ({digest.topPickCount} top picks) ·
                {digest.weekLabel || "no published weeks"}
              </p>
              {digest.lastSend && (
                <p className="text-xs text-gray-400 mt-1">
                  Last sent {new Date(digest.lastSend.sentAt).toLocaleString()} to {digest.lastSend.recipientCount} buyers.
                </p>
              )}
              {digest.skipped && <p className="text-xs text-amber-700 mt-1">{digest.skipped}</p>}
              <button onClick={sendDigest} className="mt-3 px-4 py-2 bg-green-700 text-white rounded-lg text-sm">
                Send weekly digest now
              </button>
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-2">Preview as a buyer</p>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <button onClick={sendTestDigest} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm whitespace-nowrap">
                    Send test email
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Sends exactly what buyers would get to one address. Not logged as a send.</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
        </div>
      </section>
    </div>
  );
}
