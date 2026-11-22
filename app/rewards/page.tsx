"use client";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { workspaceFetch } from "@/lib/workspace-client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import RewardsLinkForm from "@/components/RewardsLinkForm";
import { PRODUCT_SIZES } from "@/lib/product-sizes";

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

interface StorefrontItem {
  type: "deals" | "product";
  productId: string | null;
  name: string;
  tagline: string | null;
  priceCents: number;
  imageUrl: string | null;
  soldOut: boolean;
  remaining: number | null;
  offersSizes: boolean;
  requiresShipping: boolean;
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
  referralLink?: string | null;
  referralSignupPoints?: number;
  storefront?: {
    pointsPerDollar: number;
    items: StorefrontItem[];
  };
}

const KIND_LABELS: Record<string, string> = {
  referral_signup: "A friend subscribed with your link",
  purchase: "Purchase",
  redemption: "Reward redeemed",
  redeem: "Points spent",
  redeem_refund: "Points returned (checkout not finished)",
};

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// One storefront item with a points-as-money control: the reader picks
// how many points to spend (defaulted to the most that help), sees the
// cash left to pay, and checks out. Points that cover the whole price
// finish right here; anything with a cash remainder hands off to the
// item's normal Stripe checkout (the server returns its URL).
function StorefrontCard({
  item,
  email,
  balance,
  pointsPerDollar,
  dealsLifetime,
  onPointsPaid,
}: {
  item: StorefrontItem;
  email: string;
  balance: number;
  pointsPerDollar: number;
  dealsLifetime: boolean;
  onPointsPaid: () => Promise<void>;
}) {
  const rate = Math.max(1, pointsPerDollar);
  // The most points that can usefully go toward this item: the balance,
  // or what the full price costs in points, whichever is smaller.
  const maxUsefulPoints = Math.min(
    balance,
    Math.ceil((item.priceCents * rate) / 100)
  );
  const [pointsInput, setPointsInput] = useState(String(maxUsefulPoints));
  const [size, setSize] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const requested = Math.max(0, Math.floor(Number(pointsInput) || 0));
  const clamped = Math.min(requested, balance);
  const discountCents = Math.min(
    item.priceCents,
    Math.floor((clamped * 100) / rate)
  );
  const pointsSpent =
    discountCents > 0
      ? Math.min(clamped, Math.ceil((discountCents * rate) / 100))
      : 0;
  const cashCents = item.priceCents - discountCents;
  const fullyPoints = pointsSpent > 0 && cashCents === 0;

  async function handleBuy() {
    setError("");
    if (item.offersSizes && !size) {
      setError("Please choose a size.");
      return;
    }
    setBusy(true);
    try {
      const res = await workspaceFetch("/api/rewards/store/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          itemType: item.type,
          productId: item.productId ?? undefined,
          size: item.offersSizes ? size : undefined,
          pointsToApply: clamped,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else if (data.url) {
        window.location.href = data.url;
        return;
      } else if (data.pointsPaid) {
        setDone(true);
        await onPointsPaid();
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-bold text-gray-900">{item.name}</h3>
        <p className="font-semibold text-gray-800 whitespace-nowrap">
          {formatMoney(item.priceCents)}
        </p>
      </div>
      {item.tagline && <p className="text-sm text-gray-500 mb-4">{item.tagline}</p>}

      {item.type === "deals" && dealsLifetime ? (
        <p className="text-sm text-gray-500">
          You already have lifetime Deals access. This one is yours forever.
        </p>
      ) : item.soldOut ? (
        <p className="text-sm font-semibold text-gray-500">Sold out</p>
      ) : done ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          <p className="font-semibold mb-1">🎉 It&apos;s yours!</p>
          <p>
            You paid for this one entirely with points
            {item.type === "deals"
              ? ", and we emailed you the link to open your book."
              : ". We will follow up at your email about delivery."}
          </p>
        </div>
      ) : (
        <>
          {item.remaining !== null && (
            <p className="text-xs text-gray-400 mb-3">
              {item.remaining} left
            </p>
          )}
          {item.offersSizes && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              >
                <option value="">Choose a size…</option>
                {PRODUCT_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Points to use (you have {balance.toLocaleString()})
          </label>
          <input
            type="number"
            min={0}
            max={balance}
            step={1}
            value={pointsInput}
            onChange={(e) => setPointsInput(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3"
          />
          <p className="text-sm text-gray-600 mb-4">
            {pointsSpent > 0 ? (
              <>
                {pointsSpent.toLocaleString()} points takes{" "}
                {formatMoney(discountCents)} off.{" "}
              </>
            ) : null}
            {cashCents > 0 ? (
              <>
                You pay <span className="font-semibold text-gray-800">{formatMoney(cashCents)}</span>{" "}
                at checkout.
              </>
            ) : pointsSpent > 0 ? (
              <>Your points cover the whole price.</>
            ) : (
              <>Pay the full price at checkout, or use points to bring it down.</>
            )}
          </p>
          <button
            onClick={handleBuy}
            disabled={busy}
            className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {busy
              ? "One moment…"
              : fullyPoints
                ? `Buy with ${pointsSpent.toLocaleString()} points`
                : pointsSpent > 0
                  ? `Use ${pointsSpent.toLocaleString()} points and pay ${formatMoney(cashCents)}`
                  : `Buy for ${formatMoney(item.priceCents)}`}
          </button>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </>
      )}
    </div>
  );
}

function RewardsPageInner() {
  const { workspace } = useWorkspace();
  const searchParams = useSearchParams();
  // Readers arrive from their emailed personal link (/rewards?email=...),
  // the same passthrough the Deals page uses: the address they already
  // gave us is never re-typed, and the points view opens on its own.
  const emailParam = searchParams.get("email");
  const initialEmail =
    emailParam && emailParam.includes("@") ? emailParam.trim().toLowerCase() : "";
  const [email, setEmail] = useState(initialEmail);
  const [opening, setOpening] = useState(initialEmail !== "");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
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

  // Open the points view automatically when the reader lands from their
  // emailed link. Runs once per distinct link email.
  const openedFor = useRef("");
  useEffect(() => {
    if (!initialEmail || openedFor.current === initialEmail) return;
    openedFor.current = initialEmail;
    setOpening(true);
    loadSummary(initialEmail)
      .catch(() => setError("Something went wrong. Please try again."))
      .finally(() => setOpening(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail]);

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

  function copyReferralLink() {
    if (!summary?.referralLink) return;
    navigator.clipboard.writeText(summary.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
            Reader Rewards
          </h1>
          <p className="text-gray-500 text-sm">
            Earn points for referring friends and shopping with {workspace.name},
            then spend them on rewards. 100 points = $1.
          </p>
        </div>

        {!summary ? (
          <div className="space-y-3">
            {opening ? (
              <p className="text-sm text-center text-gray-500 py-4">
                Opening your Rewards page…
              </p>
            ) : (
              <>
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
                <p className="text-sm text-gray-600">
                  Enter your email and we&apos;ll send you your personal Rewards
                  link — your balance, your activity, and what your points can
                  get you, one tap away. No password needed.
                </p>
                <RewardsLinkForm />
              </>
            )}
          </div>
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
              {summary.referralLink && (
                <div className="mt-5 text-left">
                  <p className="text-sm font-semibold text-gray-800 text-center mb-3">
                    Refer friends to sign up for the newsletter -{" "}
                    {summary.referralSignupPoints ?? 50} points per subscriber!
                  </p>
                  <div className="flex items-stretch gap-2">
                    <p className="flex-1 min-w-0 text-sm font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 break-all leading-relaxed select-all">
                      {summary.referralLink}
                    </p>
                    <button
                      onClick={copyReferralLink}
                      className="shrink-0 bg-green-700 hover:bg-green-800 text-white font-semibold px-4 rounded-xl transition-colors text-sm"
                    >
                      {copied ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                </div>
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

            {/* Storefront: points as money on everything for sale */}
            {summary.storefront && summary.storefront.items.length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-6 mb-3 px-1">
                  Shop with your points
                </p>
                <p className="text-sm text-gray-500 mb-4 px-1">
                  Your points are money here:{" "}
                  {summary.storefront.pointsPerDollar.toLocaleString()} points = $1
                  off anything below. Spend points, points and cash, or just cash.
                </p>
                {summary.storefront.items.map((storeItem) => (
                  <StorefrontCard
                    key={storeItem.type === "deals" ? "deals" : storeItem.productId ?? storeItem.name}
                    item={storeItem}
                    email={email}
                    balance={balance}
                    pointsPerDollar={summary.storefront?.pointsPerDollar ?? 100}
                    dealsLifetime={isLifetime}
                    onPointsPaid={async () => {
                      await loadSummary(email.trim());
                    }}
                  />
                ))}
              </>
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
                setNotFound(false);
                setCopied(false);
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

export default function RewardsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">Loading…</p>
        </div>
      }
    >
      <RewardsPageInner />
    </Suspense>
  );
}
