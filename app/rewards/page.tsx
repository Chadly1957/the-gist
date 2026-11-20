"use client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { workspaceFetch } from "@/lib/workspace-client";

import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";

interface RewardEntry {
  kind: string;
  points: number;
  note: string | null;
  createdAt: string;
}

interface CatalogItem {
  key: string;
  title: string;
  description: string | null;
  costPoints: number;
  kind: string;
}

interface Summary {
  found: boolean;
  firstName?: string | null;
  balance?: number;
  totalEarned?: number;
  totalRedeemed?: number;
  entries?: RewardEntry[];
  catalog?: CatalogItem[];
  dealsAccess?: {
    hasAccess: boolean;
    isLifetime: boolean;
    accessUntil: string | null;
  };
  referralCode?: string | null;
}

const KIND_LABELS: Record<string, string> = {
  referral_signup: "A friend subscribed with your link",
  purchase: "Purchase",
  redemption: "Reward redeemed",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RewardsPage() {
  const { workspace } = useWorkspace();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState<{ code: string; accessUntil: string } | null>(null);
  const [redeemError, setRedeemError] = useState("");

  async function loadSummary(forEmail: string) {
    const res = await workspaceFetch("/api/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forEmail }),
    });
    const data = await res.json();
    if (!data.found) {
      setNotFound(true);
      setSummary(null);
      return;
    }
    setNotFound(false);
    setSummary(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setRedeemed(null);
    setRedeemError("");
    setLoading(true);
    try {
      await loadSummary(email.trim());
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRedeem(itemKey: string) {
    setRedeemError("");
    setRedeeming(true);
    try {
      const res = await workspaceFetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), itemKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRedeemError(data.error || "Something went wrong. Please try again.");
      } else {
        setRedeemed({ code: data.code, accessUntil: data.accessUntil });
        await loadSummary(email.trim());
      }
    } catch {
      setRedeemError("Something went wrong. Please try again.");
    } finally {
      setRedeeming(false);
    }
  }

  const item = summary?.catalog?.[0];
  const balance = summary?.balance ?? 0;
  const canAfford = item ? balance >= item.costPoints : false;
  const isLifetime = summary?.dealsAccess?.isLifetime ?? false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <SiteHeader />

      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
            ⭐ Reader Rewards
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
            Your {workspace.name} Points
          </h1>
          <p className="text-gray-500 text-sm">
            Earn points for referring friends and shopping with {workspace.name},
            then spend them on rewards. 100 points = $1.
          </p>
        </div>

        {!summary ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              />
            </div>
            {notFound && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                We couldn&apos;t find an active subscription for that email. Subscribe
                first, then come back to see your points.
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
            >
              {loading ? "Looking up your points…" : "See My Points →"}
            </button>
            <p className="text-xs text-center text-gray-400">
              Use the email you subscribe with. No password needed.
            </p>
          </form>
        ) : (
          <>
            {/* Balance */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                Your balance
              </p>
              <p className="text-4xl font-bold text-gray-900 mb-3">
                {balance.toLocaleString()}{" "}
                <span className="text-base font-semibold text-gray-400">points</span>
              </p>
              <div className="flex justify-center gap-6 text-sm">
                <span className="text-gray-500">
                  Earned:{" "}
                  <span className="font-semibold text-gray-800">
                    {(summary.totalEarned ?? 0).toLocaleString()}
                  </span>
                </span>
                <span className="text-gray-500">
                  Redeemed:{" "}
                  <span className="font-semibold text-gray-800">
                    {(summary.totalRedeemed ?? 0).toLocaleString()}
                  </span>
                </span>
              </div>
              {summary.referralCode && (
                <p className="text-xs text-gray-400 mt-4">
                  Tip: every friend who subscribes through your referral link earns
                  you points. Your link is on the{" "}
                  <a href="/contest" className="text-green-700 underline">
                    giveaway page
                  </a>
                  .
                </p>
              )}
            </div>

            {/* Catalog */}
            {item && (
              <div className="bg-white border-2 border-green-200 rounded-2xl p-6 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Spend your points
                </p>
                <h2 className="text-lg font-bold text-gray-900 mb-1">{item.title}</h2>
                {item.description && (
                  <p className="text-sm text-gray-500 mb-4">{item.description}</p>
                )}
                <p className="text-sm font-semibold text-gray-800 mb-4">
                  {item.costPoints.toLocaleString()} points
                </p>

                {redeemed ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                    <p className="font-semibold mb-1">🎉 You&apos;re in!</p>
                    <p>
                      Your Deals year runs through {formatDate(redeemed.accessUntil)}.
                      We emailed you the link to open your book. Your redemption code
                      is <span className="font-mono font-semibold">{redeemed.code}</span>.
                    </p>
                  </div>
                ) : isLifetime ? (
                  <p className="text-sm text-gray-500">
                    You already have lifetime Deals access, so this one is on the
                    house forever. Save your points for future rewards.
                  </p>
                ) : (
                  <>
                    {summary.dealsAccess?.hasAccess && summary.dealsAccess.accessUntil && (
                      <p className="text-xs text-gray-400 mb-3">
                        You already have Deals through{" "}
                        {formatDate(summary.dealsAccess.accessUntil)}. Redeeming adds
                        a year on top of that.
                      </p>
                    )}
                    <button
                      onClick={() => handleRedeem(item.key)}
                      disabled={!canAfford || redeeming}
                      className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                    >
                      {redeeming
                        ? "Redeeming…"
                        : canAfford
                          ? `Redeem for ${item.costPoints.toLocaleString()} points`
                          : `You need ${(item.costPoints - balance).toLocaleString()} more points`}
                    </button>
                    {redeemError && (
                      <p className="text-sm text-red-600 mt-3">{redeemError}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Recent activity */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
                Recent activity
              </p>
              {(summary.entries ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nothing yet. Refer a friend or make a purchase to earn your first
                  points.
                </p>
              ) : (
                <div className="space-y-3">
                  {(summary.entries ?? []).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-700">
                          {entry.note || KIND_LABELS[entry.kind] || entry.kind}
                        </p>
                        <p className="text-xs text-gray-400">{formatDate(entry.createdAt)}</p>
                      </div>
                      <span
                        className={`font-semibold ${entry.points >= 0 ? "text-green-700" : "text-gray-700"}`}
                      >
                        {entry.points >= 0 ? "+" : ""}
                        {entry.points.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setSummary(null);
                setRedeemed(null);
                setRedeemError("");
              }}
              className="mt-6 w-full text-xs text-gray-400 underline"
            >
              Check a different email
            </button>
          </>
        )}
      </main>
    </div>
  );
}
