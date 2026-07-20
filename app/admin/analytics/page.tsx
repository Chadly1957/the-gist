"use client";

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
      const res = await fetch(`/api/admin/newsletter/resend/${sendId}`, { method: "POST" });
      const data = await res.json();
      setResendResult((prev) => ({ ...prev, [sendId]: { ok: res.ok, message: data.message || data.error || "Unknown error" } }));
    } catch {
      setResendResult((prev) => ({ ...prev, [sendId]: { ok: false, message: "Request failed — check Vercel logs." } }));
    } finally {
      setResending((prev) => ({ ...prev, [sendId]: false }));
    }
  }

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((data) => {
        setSends(data.sends || []);
        setSummary(data.summary || null);
        setSponsorBreakdown(data.sponsorBreakdown || null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">
          Open rates, click rates, unsubscribes, and sponsor performance across your sends.
        </p>
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
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gray-700 min-w-0 truncate hover:text-green-700 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {a.label}
                                  </a>
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
