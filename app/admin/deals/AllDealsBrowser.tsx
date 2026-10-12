"use client";

import { useCallback, useEffect, useState } from "react";
import { workspaceFetch } from "@/lib/workspace-client";
import WsBadge from "@/app/admin/components/WsBadge";

interface WsInfo {
  id: string;
  slug: string;
  name: string;
  primaryColor: string;
}

interface DealRow {
  id: string;
  title: string;
  price: string | null;
  regPrice: string | null;
  category: string | null;
  businessName: string | null;
  isTopPick: boolean;
  workspace: { slug: string; name: string };
  dealWeek: {
    id: string;
    weekStart: string;
    weekEnd: string;
    status: string;
    retailer: { id: string; displayName: string; slug: string };
  };
}

const PAGE_SIZE = 50;

export default function AllDealsBrowser() {
  const [workspaces, setWorkspaces] = useState<WsInfo[]>([]);
  const [retailers, setRetailers] = useState<Array<{ id: string; slug: string; displayName: string; pipeline: string; workspace: { slug: string; name: string } }>>([]);
  const [weeks, setWeeks] = useState<Array<{ id: string; weekStart: string; weekEnd: string; status: string; retailer: { displayName: string }; workspace: { slug: string; name: string } }>>([]);

  const [wsFilter, setWsFilter] = useState("all");
  const [retailerFilter, setRetailerFilter] = useState("");
  const [weekFilter, setWeekFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [qCommitted, setQCommitted] = useState("");
  const [page, setPage] = useState(1);

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter option lists (one fetch).
  useEffect(() => {
    (async () => {
      const [wRes, rRes, wkRes] = await Promise.all([
        workspaceFetch("/api/admin/workspaces"),
        workspaceFetch("/api/admin/deals/retailers?scope=all"),
        workspaceFetch("/api/admin/deals/weeks?scope=all"),
      ]);
      if (wRes.ok) setWorkspaces((await wRes.json()).workspaces || []);
      if (rRes.ok) setRetailers((await rRes.json()).retailers || []);
      if (wkRes.ok) setWeeks((await wkRes.json()).weeks || []);
    })();
  }, []);

  const colorOf = useCallback(
    (slug: string) => workspaces.find((w) => w.slug === slug)?.primaryColor,
    [workspaces]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspace: wsFilter,
        retailer: retailerFilter,
        week: weekFilter,
        status: statusFilter,
        q: qCommitted,
        page: String(page),
      });
      const res = await workspaceFetch(`/api/admin/deals/all?${params}`);
      const data = await res.json();
      setDeals(data.deals || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [wsFilter, retailerFilter, weekFilter, statusFilter, qCommitted, page]);

  useEffect(() => { load(); }, [load]);

  function resetPageAnd(fn: () => void) {
    setPage(1);
    fn();
  }

  const filteredRetailers = retailers.filter((r) => wsFilter === "all" || r.workspace.slug === wsFilter);
  const filteredWeeks = weeks.filter(
    (w) =>
      (wsFilter === "all" || w.workspace.slug === wsFilter) &&
      (!retailerFilter || w.retailer.displayName === filteredRetailers.find((r) => r.id === retailerFilter)?.displayName)
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const selectCls = "border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white max-w-[180px]";

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-2 items-center">
        <select value={wsFilter} onChange={(e) => resetPageAnd(() => { setWsFilter(e.target.value); setRetailerFilter(""); setWeekFilter(""); })} className={selectCls} aria-label="Filter by workspace">
          <option value="all">All workspaces</option>
          {workspaces.map((w) => (
            <option key={w.slug} value={w.slug}>{w.name}</option>
          ))}
        </select>
        <select value={retailerFilter} onChange={(e) => resetPageAnd(() => { setRetailerFilter(e.target.value); setWeekFilter(""); })} className={selectCls} aria-label="Filter by retailer">
          <option value="">All retailers</option>
          {filteredRetailers.map((r) => (
            <option key={r.id} value={r.id}>{r.displayName}{wsFilter === "all" ? ` (${r.workspace.name})` : ""}</option>
          ))}
        </select>
        <select value={weekFilter} onChange={(e) => resetPageAnd(() => setWeekFilter(e.target.value))} className={selectCls} aria-label="Filter by week">
          <option value="">All weeks</option>
          {filteredWeeks.slice(0, 60).map((w) => (
            <option key={w.id} value={w.id}>
              {w.retailer.displayName} · week of {w.weekStart} · {w.status}{wsFilter === "all" ? ` (${w.workspace.name})` : ""}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => resetPageAnd(() => setStatusFilter(e.target.value))} className={selectCls} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <form
          className="flex gap-2 flex-1 min-w-[180px]"
          onSubmit={(e) => { e.preventDefault(); resetPageAnd(() => setQCommitted(q)); }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search deals…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <button type="submit" className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Search</button>
        </form>
      </div>

      {/* Results */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : deals.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">No deals match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Deal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Workspace</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Retailer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Week</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">
                        <span className={d.isTopPick ? "text-amber-500 mr-1" : "text-gray-300 mr-1"}>★</span>
                        {d.businessName && <span className="text-gray-500 font-normal">{d.businessName}: </span>}
                        {d.title}
                      </p>
                      {d.category && <p className="text-xs text-gray-400 mt-0.5">{d.category}</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      {d.price || <span className="text-gray-300 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <WsBadge name={d.workspace.name} color={colorOf(d.workspace.slug)} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.dealWeek.retailer.displayName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">week of {d.dealWeek.weekStart}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${d.dealWeek.status === "published" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                        {d.dealWeek.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <p>Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} deals</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 bg-white">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 bg-white">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
