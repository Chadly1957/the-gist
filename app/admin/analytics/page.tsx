"use client";
import { WorkspaceAnchor } from "@/components/workspace/WorkspaceLink";

import { workspaceFetch } from "@/lib/workspace-client";

import { Fragment, useEffect, useState } from "react";

interface SponsoredClick {
  type: string;
  label: string;
  clicks: number;
  impressions: number;
}

interface ArticleClick {
  label: string;
  url: string;
  clicks: number;
}

interface SendStats {
  id: string;
  subject: string;
  sentAt: string;
  status: string;
  tracked: boolean;
  recipientCount: number;
  uniqueOpens: number;
  openRate: number;
  uniqueClicks: number;
  clickRate: number;
  totalClicks: number;
  unsubscribes: number;
  sponsoredClicks: SponsoredClick[];
  articleClicks: ArticleClick[];
}

interface Summary {
  recipientCount: number;
  uniqueOpens: number;
  uniqueClicks: number;
  unsubscribes: number;
  sponsoredClicks: number;
  sponsoredImpressions: number;
  avgOpenRate: number;
  avgClickRate: number;
}

interface TypeStat { impressions: number; clicks: number; }

interface OverviewReader {
  id: string;
  email: string;
  firstName: string | null;
  subscribedAt: string;
  opens: number;
  openEvents: number;
  clicks: number;
  clickEvents: number;
  sends: number;
  state: string;
  dealsBuyer: boolean;
  hasOrder: boolean;
  referred: boolean;
  referredBy: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrer: string | null;
}

interface OverviewData {
  days: number;
  totals: {
    activeReaders: number;
    newInPeriod: number;
    avgOpensPerReader: number;
    totalClickEvents: number;
    dealsBuyers: number;
    referredReaders: number;
  };
  segments: Record<string, number>;
  acquisition: { label: string; count: number }[];
  topLinks: { url: string; label: string; type: string; clicks: number }[];
  trend: { subject: string; sentAt: string; opens: number; clicks: number; recipients: number }[];
  topReaders: OverviewReader[];
  readerCount: number;
}

interface ReaderDetail {
  reader: {
    id: string;
    email: string;
    firstName: string | null;
    subscribedAt: string;
    active: boolean;
    state: string;
    acquisition: { kind: string; source: string | null; medium?: string | null; campaign?: string | null };
  };
  stats: {
    days: number;
    opens: number;
    openEvents: number;
    clicks: number;
    clickEvents: number;
    sendsReceived: number;
    lifetimeOpens: number;
    lifetimeClickEvents: number;
    clickByType: Record<string, number>;
  };
  purchases: {
    deals: { id: string; createdAt: string; isLifetime: boolean }[];
    orders: { id: string; name: string; amountCents: number; paidAt: string | null }[];
  };
  referrals: {
    code: string | null;
    referredCount: number;
    referred: { id: string | null; email: string | null; firstName: string | null; at: string }[];
  };
  recentSends: {
    id: string;
    subject: string;
    sentAt: string;
    opened: boolean;
    openCount: number;
    clicked: boolean;
    clickCount: number;
  }[];
  timeline: { kind: string; at: string; label: string; detail: string }[];
}

const STATE_BADGES: Record<string, string> = {
  "Highly engaged": "bg-green-100 text-green-800",
  Engaged: "bg-blue-100 text-blue-800",
  New: "bg-purple-100 text-purple-800",
  Quiet: "bg-gray-100 text-gray-600",
  "At risk": "bg-amber-100 text-amber-800",
  Fading: "bg-red-100 text-red-700",
};

interface SponsorEntry {
  type: string;
  label: string;
  impressions: number;
  clicks: number;
  issues: number;
}

interface SponsorBreakdown {
  byType: Record<string, TypeStat>;
  topSponsors: SponsorEntry[];
}

const SPONSOR_TYPE_LABELS: Record<string, string> = {
  spotlight: "Community Partner",
  presenting_sponsor: "Presenting Sponsor",
  in_article_ad: "Standard Ad",
};

const SPONSOR_TYPE_ORDER = ["presenting_sponsor", "in_article_ad", "spotlight"] as const;
const SPONSOR_TYPE_COLORS: Record<string, { bg: string; text: string; badge: string; bar: string }> = {
  presenting_sponsor: { bg: "bg-purple-50", text: "text-purple-700", badge: "bg-purple-100 text-purple-700", bar: "bg-purple-500" },
  in_article_ad:      { bg: "bg-blue-50",   text: "text-blue-700",   badge: "bg-blue-100 text-blue-700",     bar: "bg-blue-500"   },
  spotlight:          { bg: "bg-green-50",  text: "text-green-700",  badge: "bg-green-100 text-green-700",   bar: "bg-green-500"  },
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function AnalyticsPage() {
  const [sends, setSends] = useState<SendStats[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sponsorBreakdown, setSponsorBreakdown] = useState<SponsorBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resending, setResending] = useState<Record<string, boolean>>({});
  const [resendResult, setResendResult] = useState<Record<string, { ok: boolean; message: string } | undefined>>({});

  async function handleResend(sendId: string) {
    setResending((prev) => ({ ...prev, [sendId]: true }));
    setResendResult((prev) => ({ ...prev, [sendId]: undefined }));
    try {
      const res = await workspaceFetch(`/api/admin/newsletter/resend/${sendId}`, { method: "POST" });
      const data = await res.json();
      setResendResult((prev) => ({ ...prev, [sendId]: { ok: res.ok, message: data.message || data.error || "Unknown error" } }));
    } catch {
      setResendResult((prev) => ({ ...prev, [sendId]: { ok: false, message: "Request failed — check Vercel logs." } }));
    } finally {
      setResending((prev) => ({ ...prev, [sendId]: false }));
    }
  }

  useEffect(() => {
    workspaceFetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((data) => {
        setSends(data.sends || []);
        setSummary(data.summary || null);
        setSponsorBreakdown(data.sponsorBreakdown || null);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Readers (Command Center) ──────────────────────────────────────────
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [readerQuery, setReaderQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReaderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setOvLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (submittedQuery) params.set("q", submittedQuery);
    if (segmentFilter !== "All") params.set("segment", segmentFilter);
    workspaceFetch(`/api/admin/analytics/overview?${params}`)
      .then((res) => res.json())
      .then((data) => setOverview(data))
      .finally(() => setOvLoading(false));
  }, [days, submittedQuery, segmentFilter]);

  function openReader(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    workspaceFetch(`/api/admin/analytics/readers/${id}?days=${days}`)
      .then((res) => res.json())
      .then((data) => setDetail(data))
      .finally(() => setDetailLoading(false));
  }

  // Segment filtering happens server-side (see the overview API): the table
  // holds the top 50 of the selected segment, not the top 50 overall.
  const visibleReaders = overview?.topReaders ?? [];

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">
          Readers first: who opens, clicks, buys, and refers. Per-issue performance is further down the page.
        </p>
      </div>

      {/* ── Readers (Command Center) ─────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-bold text-gray-900">Readers</h2>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                  days === d ? "bg-green-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {selectedId && detailLoading && (
          <p className="text-sm text-gray-500 py-8 text-center">Loading reader…</p>
        )}

        {selectedId && !detailLoading && detail && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <button type="button" onClick={() => { setSelectedId(null); setDetail(null); }} className="text-sm text-blue-600 hover:underline mb-4">
              ← Back to readers
            </button>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {detail.reader.firstName || detail.reader.email.split("@")[0]}
                </h3>
                <p className="text-sm text-gray-500">{detail.reader.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Subscribed {new Date(detail.reader.subscribedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {!detail.reader.active && " · Unsubscribed"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATE_BADGES[detail.reader.state] ?? "bg-gray-100 text-gray-600"}`}>
                  {detail.reader.state}
                </span>
                {detail.purchases.deals.length > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">Deals buyer</span>
                )}
                {detail.purchases.orders.length > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">Product buyer</span>
                )}
                {detail.referrals.referredCount > 0 && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                    Referred {detail.referrals.referredCount}
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-3">
              Came from:{" "}
              {detail.reader.acquisition.kind === "ad" && (
                <>Meta / {detail.reader.acquisition.source}{detail.reader.acquisition.campaign ? ` · ${detail.reader.acquisition.campaign}` : ""}</>
              )}
              {detail.reader.acquisition.kind === "referral" && <>Referred by {detail.reader.acquisition.source}</>}
              {detail.reader.acquisition.kind === "link" && <>{detail.reader.acquisition.source}</>}
              {detail.reader.acquisition.kind === "unknown" && (
                <span className="text-gray-400">Unknown (joined before UTM capture)</span>
              )}
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {[
                { label: `Opens · last ${detail.stats.days}d`, value: detail.stats.opens, sub: `${detail.stats.openEvents} open events` },
                { label: `Clicks · last ${detail.stats.days}d`, value: detail.stats.clickEvents, sub: `${detail.stats.clicks} issues with a click` },
                { label: "Sends received", value: detail.stats.sendsReceived, sub: `in the last ${detail.stats.days} days` },
                { label: "Lifetime opens", value: detail.stats.lifetimeOpens, sub: `${detail.stats.lifetimeClickEvents} lifetime clicks` },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recent sends</p>
                {detail.recentSends.length === 0 ? (
                  <p className="text-sm text-gray-400">No sends on record.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.recentSends.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-700 truncate">{s.subject}</span>
                        <span className="text-xs text-gray-500 shrink-0">
                          {new Date(s.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {" · "}
                          {s.opened ? <span className="text-green-700 font-medium">Opened{s.openCount > 1 ? ` ×${s.openCount}` : ""}</span> : "Not opened"}
                          {s.clicked && <span className="text-blue-700 font-medium"> · Clicked</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Activity timeline</p>
                {detail.timeline.length === 0 ? (
                  <p className="text-sm text-gray-400">Nothing yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.timeline.map((t, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-700 truncate">
                          <span className="text-gray-400 text-xs uppercase mr-2">{t.kind}</span>
                          {t.label}
                        </span>
                        <span className="text-xs text-gray-500 shrink-0">
                          {new Date(t.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {detail.referrals.referred.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Readers they referred ({detail.referrals.referredCount})
                    </p>
                    {detail.referrals.referred.map((r) => (
                      <p key={r.id ?? r.email ?? ""} className="text-sm text-gray-600">
                        {r.firstName || r.email} · {new Date(r.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedId && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[
                { label: "Active readers", value: overview?.totals.activeReaders ?? "—", sub: "this workspace" },
                { label: `New · last ${days}d`, value: overview?.totals.newInPeriod ?? "—", sub: "joined in period" },
                { label: "Avg opens / reader", value: overview ? overview.totals.avgOpensPerReader.toFixed(1) : "—", sub: `last ${days} days` },
                { label: "Deals buyers", value: overview?.totals.dealsBuyers ?? "—", sub: `${overview?.totals.referredReaders ?? 0} readers came via referral` },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {["All", "Highly engaged", "Engaged", "New", "Quiet", "At risk", "Fading"].map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setSegmentFilter(seg)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    segmentFilter === seg ? "bg-green-700 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {seg} ({seg === "All" ? overview?.totals.activeReaders ?? "…" : overview?.segments[seg] ?? 0})
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-semibold text-gray-800 mb-3">Where readers came from</p>
                {ovLoading || !overview ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : overview.acquisition.length === 0 ? (
                  <p className="text-sm text-gray-400">No acquisition data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {overview.acquisition.map((a) => (
                      <div key={a.label} className="flex items-center justify-between text-sm gap-3">
                        <span className="text-gray-700 truncate">{a.label}</span>
                        <span className="font-semibold text-gray-900 shrink-0">{a.count.toLocaleString()}</span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 pt-1">
                      UTM capture started with this dashboard; earlier readers show as Unknown.
                    </p>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm font-semibold text-gray-800 mb-3">Most-clicked links · last {days} days</p>
                {ovLoading || !overview ? (
                  <p className="text-sm text-gray-400">Loading…</p>
                ) : overview.topLinks.length === 0 ? (
                  <p className="text-sm text-gray-400">No clicks in this period.</p>
                ) : (
                  <div className="space-y-2">
                    {overview.topLinks.slice(0, 6).map((l) => (
                      <div key={l.url} className="flex items-center justify-between text-sm gap-3">
                        <span className="text-gray-700 truncate" title={l.url}>{l.label}</span>
                        <span className="font-semibold text-gray-900 shrink-0">{l.clicks} clicks</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); setSubmittedQuery(readerQuery); }}
              className="flex gap-2 mb-4"
            >
              <input
                value={readerQuery}
                onChange={(e) => setReaderQuery(e.target.value)}
                placeholder="Search readers by name or email…"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
              <button type="submit" className="px-4 py-2 bg-green-700 text-white text-sm font-semibold rounded-lg hover:bg-green-800">
                Search
              </button>
              {submittedQuery && (
                <button type="button" onClick={() => { setReaderQuery(""); setSubmittedQuery(""); }} className="px-3 py-2 text-sm text-gray-500 hover:underline">
                  Clear
                </button>
              )}
            </form>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-800">
                  Top readers · {overview?.readerCount.toLocaleString() ?? "…"} matching
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Click a reader for their full history. Ranked by opens, then clicks.</p>
              </div>
              {ovLoading || !overview ? (
                <div className="py-10 text-center">
                  <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : visibleReaders.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-400 text-center">No readers match.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Reader</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">State</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Opens</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Clicks</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Came from</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleReaders.map((r) => (
                        <tr key={r.id} onClick={() => openReader(r.id)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer">
                          <td className="px-5 py-3">
                            <span className="font-medium text-gray-800">{r.firstName || r.email.split("@")[0]}</span>
                            <span className="text-gray-400 text-xs block">{r.email}</span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATE_BADGES[r.state] ?? "bg-gray-100 text-gray-600"}`}>
                              {r.state}
                            </span>
                            {r.dealsBuyer && <span className="ml-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Deals</span>}
                            {r.referred && <span className="ml-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">Referred</span>}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">{r.opens}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{r.clickEvents}</td>
                          <td className="px-5 py-3 text-gray-500 text-xs">
                            {r.utmSource ? `Ad · ${r.utmSource}${r.utmCampaign ? ` / ${r.utmCampaign}` : ""}` : r.referred ? `Referred${r.referredBy ? ` by ${r.referredBy}` : ""}` : "Unknown"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Avg Open Rate",
            value: summary ? pct(summary.avgOpenRate) : "—",
            sub: `${summary?.uniqueOpens.toLocaleString() ?? 0} unique opens`,
            color: "text-green-600",
          },
          {
            label: "Avg Click Rate",
            value: summary ? pct(summary.avgClickRate) : "—",
            sub: `${summary?.uniqueClicks.toLocaleString() ?? 0} unique clicks`,
            color: "text-blue-600",
          },
          {
            label: "Unsubscribes",
            value: summary?.unsubscribes.toLocaleString() ?? "—",
            sub: "across tracked sends",
            color: "text-red-600",
          },
          {
            label: "Sponsor Impressions",
            value: summary?.sponsoredImpressions.toLocaleString() ?? "—",
            sub: `${summary?.sponsoredClicks.toLocaleString() ?? 0} total clicks`,
            color: "text-amber-600",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              {stat.label}
            </p>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Sponsored Content Breakdown ─────────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-900 mb-4">Sponsored Content Performance</h2>

        {/* Per-type summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {SPONSOR_TYPE_ORDER.map((typeKey) => {
            const stat = sponsorBreakdown?.byType[typeKey];
            const label = SPONSOR_TYPE_LABELS[typeKey];
            const colors = SPONSOR_TYPE_COLORS[typeKey];
            const ctr = stat && stat.impressions > 0 ? stat.clicks / stat.impressions : 0;
            return (
              <div key={typeKey} className={`rounded-xl border border-gray-200 p-5 ${colors.bg}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${colors.text}`}>{label}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold text-gray-900">{stat?.impressions.toLocaleString() ?? "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Impressions</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{stat?.clicks.toLocaleString() ?? "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Clicks</p>
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${colors.text}`}>{stat ? pct(ctr) : "—"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">CTR</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top performers table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Top Performing Sponsors</p>
            <p className="text-xs text-gray-400 mt-0.5">All-time · ranked by clicks</p>
          </div>
          {loading || !sponsorBreakdown ? (
            <div className="py-10 text-center">
              <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : sponsorBreakdown.topSponsors.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No sponsor click data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sponsor</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Issues</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Impressions</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Clicks</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {sponsorBreakdown.topSponsors.map((s, i) => {
                    const ctr = s.impressions > 0 ? s.clicks / s.impressions : 0;
                    const colors = SPONSOR_TYPE_COLORS[s.type] ?? SPONSOR_TYPE_COLORS.spotlight;
                    const maxClicks = sponsorBreakdown.topSponsors[0]?.clicks ?? 1;
                    const barWidth = maxClicks > 0 ? (s.clicks / maxClicks) * 100 : 0;
                    return (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-28 sm:w-40 h-1.5 bg-gray-100 rounded-full shrink-0">
                              <div
                                className={`h-1.5 rounded-full ${colors.bar}`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="font-medium text-gray-800">{s.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {SPONSOR_TYPE_LABELS[s.type] ?? s.type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700 font-medium">{s.issues > 0 ? s.issues : "—"}</td>
                        <td className="px-5 py-3 text-right text-gray-500">{s.impressions.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">{s.clicks.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right font-semibold text-green-700">{pct(ctr)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Per-send table ───────────────────────────────────────────────── */}
      <h2 className="text-base font-bold text-gray-900 mb-4">Send History</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Subject</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sent</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Recipients</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Open Rate</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Click Rate</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Unsubs</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sponsor Clicks</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && sends.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  No sends yet.
                </td>
              </tr>
            )}
            {sends.map((send) => {
              const sponsorTotal = send.sponsoredClicks.reduce((sum, s) => sum + s.clicks, 0);
              const articleTotal = (send.articleClicks ?? []).reduce((sum, a) => sum + a.clicks, 0);
              const isExpanded = expanded === send.id;
              return (
                <Fragment key={send.id}>
                  <tr
                    className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpanded(isExpanded ? null : send.id)}
                  >
                    <td className="px-5 py-3 font-medium text-gray-800">{send.subject}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(send.sentAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{send.recipientCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {send.tracked ? `${pct(send.openRate)} (${send.uniqueOpens})` : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {send.tracked ? `${pct(send.clickRate)} (${send.uniqueClicks})` : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{send.tracked ? send.unsubscribes : "—"}</td>
                    <td className="px-5 py-3 text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        {send.tracked ? sponsorTotal : "—"}
                        <svg
                          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={7} className="px-5 py-4 space-y-4">
                        {/* Resend */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleResend(send.id); }}
                            disabled={resending[send.id]}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {resending[send.id] ? "Resending…" : "Resend to all subscribers"}
                          </button>
                          {(() => {
                            const r = resendResult[send.id];
                            return r ? (
                              <span className={`text-xs font-medium ${r.ok ? "text-green-700" : "text-red-600"}`}>
                                {r.message}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {/* Article clicks */}
                        {(send.articleClicks ?? []).length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                              Article clicks
                            </div>
                            <div className="space-y-1.5">
                              {(send.articleClicks ?? []).map((a, i) => (
                                <div key={i} className="flex items-center justify-between text-sm gap-4">
                                  <WorkspaceAnchor
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-700 min-w-0 truncate hover:text-green-700 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {a.label}
                                  </WorkspaceAnchor>
                                  <span className="font-semibold text-gray-900 shrink-0">
                                    {a.clicks} {a.clicks === 1 ? "click" : "clicks"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Sponsor clicks */}
                        {send.sponsoredClicks.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                              Sponsor click breakdown
                            </div>
                            <div className="space-y-1.5">
                              {send.sponsoredClicks.map((s, i) => {
                                const ctr = s.impressions > 0 ? s.clicks / s.impressions : 0;
                                return (
                                  <div key={i} className="flex items-center justify-between text-sm gap-4">
                                    <span className="text-gray-700 min-w-0">
                                      {s.label}{" "}
                                      <span className="text-gray-400 text-xs">
                                        ({SPONSOR_TYPE_LABELS[s.type] || s.type})
                                      </span>
                                    </span>
                                    <span className="text-gray-500 shrink-0 text-xs">
                                      {s.impressions.toLocaleString()} impressions
                                      {" · "}
                                      <span className="font-semibold text-gray-900">{s.clicks} clicks</span>
                                      {" · "}
                                      <span className="text-green-700">{pct(ctr)} CTR</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
