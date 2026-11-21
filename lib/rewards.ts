import { Prisma, type PrismaClient } from "@prisma/client";
import {
  couponBookPrepaidYearEnd,
  couponBookPurchaseHasAccess,
} from "@/lib/coupon-book";

// Reader Rewards (phase 1): points live in an append-only ledger
// (RewardPointEntry); a reader's balance is the SUM of their entries and is
// never stored as a counter. Base ratio: 100 points = $1.
//
// Every function here takes the UNSCOPED client (basePrisma) plus an
// explicit workspaceId, matching the Stripe webhook, because the earn hooks
// run outside request workspace context. Values come from per-workspace
// Setting rows (editable in Admin > Settings, no deploy needed) with the
// defaults below.

export const REWARD_KIND_REFERRAL_SIGNUP = "referral_signup";
export const REWARD_KIND_PURCHASE = "purchase";
export const REWARD_KIND_REDEMPTION = "redemption";

export const DEALS_FREE_YEAR_KEY = "deals_free_year";

const SETTING_KEYS = {
  referralSignupPoints: "rewards_referral_signup_points",
  purchasePointsPerDollar: "rewards_purchase_points_per_dollar",
  dealsYearCostPoints: "rewards_deals_year_cost_points",
} as const;

export const REWARD_SETTING_KEYS: string[] = Object.values(SETTING_KEYS);

const DEFAULTS = {
  referralSignupPoints: 50,
  purchasePointsPerDollar: 5,
  dealsYearCostPoints: 1500,
} as const;

export interface RewardConfig {
  referralSignupPoints: number;
  purchasePointsPerDollar: number;
  dealsYearCostPoints: number;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getRewardConfig(
  db: PrismaClient,
  workspaceId: string
): Promise<RewardConfig> {
  const rows = await db.setting.findMany({
    where: { workspaceId, key: { in: REWARD_SETTING_KEYS } },
    select: { key: true, value: true },
  });
  const values: Record<string, string> = {};
  for (const row of rows) values[row.key] = row.value;
  return {
    referralSignupPoints: parseNonNegativeInt(
      values[SETTING_KEYS.referralSignupPoints],
      DEFAULTS.referralSignupPoints
    ),
    purchasePointsPerDollar: parseNonNegativeInt(
      values[SETTING_KEYS.purchasePointsPerDollar],
      DEFAULTS.purchasePointsPerDollar
    ),
    dealsYearCostPoints: parseNonNegativeInt(
      values[SETTING_KEYS.dealsYearCostPoints],
      DEFAULTS.dealsYearCostPoints
    ),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

// Earn hook: a new subscriber signed up through a reader's referral link.
// Idempotent per ReferralSignup row (the ledger's unique index on
// (workspaceId, kind, sourceRef) is the guard), so a retried or replayed
// signup can never pay the referrer twice. No-ops when the referrer cannot
// be resolved to a subscriber in this workspace. Returns true when points
// were actually appended.
export async function awardReferralPoints(
  db: PrismaClient,
  args: {
    workspaceId: string;
    referralSignupId: string;
    referrerSubscriberId: string;
    newSubscriberId: string;
    note?: string;
  }
): Promise<boolean> {
  if (!args.referrerSubscriberId || !args.referralSignupId) return false;
  if (args.referrerSubscriberId === args.newSubscriberId) return false;
  const referrer = await db.subscriber.findFirst({
    where: { id: args.referrerSubscriberId, workspaceId: args.workspaceId },
    select: { id: true },
  });
  if (!referrer) return false;
  const config = await getRewardConfig(db, args.workspaceId);
  if (config.referralSignupPoints <= 0) return false;
  try {
    await db.rewardPointEntry.create({
      data: {
        workspaceId: args.workspaceId,
        subscriberId: referrer.id,
        kind: REWARD_KIND_REFERRAL_SIGNUP,
        points: config.referralSignupPoints,
        sourceRef: args.referralSignupId,
        note: args.note ?? null,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

// Earn hook: a paid product or Deals purchase. Points are whole dollars of
// the order amount times the configured per-dollar rate (default 5 pts per
// $1). The buyer is resolved by email, because purchase rows are
// email-keyed; a buyer with no subscriber row in this workspace earns
// nothing (safe no-op). Idempotent per Stripe checkout session.
export async function awardPurchasePoints(
  db: PrismaClient,
  args: {
    workspaceId: string;
    email: string;
    amountCents: number;
    sessionId: string;
    note?: string;
  }
): Promise<boolean> {
  const email = (args.email || "").trim().toLowerCase();
  if (!email || !email.includes("@") || !args.sessionId) return false;
  const subscriber = await db.subscriber.findFirst({
    where: { workspaceId: args.workspaceId, email },
    select: { id: true },
  });
  if (!subscriber) return false;
  const config = await getRewardConfig(db, args.workspaceId);
  const points =
    Math.floor(Math.max(0, args.amountCents) / 100) *
    config.purchasePointsPerDollar;
  if (points <= 0) return false;
  try {
    await db.rewardPointEntry.create({
      data: {
        workspaceId: args.workspaceId,
        subscriberId: subscriber.id,
        kind: REWARD_KIND_PURCHASE,
        points,
        sourceRef: args.sessionId,
        note: args.note ?? null,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

// ── Launch backfill ─────────────────────────────────────────────────────
//
// Retroactive credit for activity from before Reader Rewards existed,
// triggered by an admin from Admin > Settings (POST
// /api/admin/rewards/backfill), once per workspace at launch. It never
// runs automatically.
//
// The backfill awards through the same two hooks the live flow uses, so
// every entry it creates carries the same (workspaceId, kind, sourceRef)
// idempotency key the live flow writes: a ReferralSignup id for a
// referral, a Stripe checkout session id for a purchase. Re-running it
// therefore creates nothing new, and the live flow can never double-award
// a backfilled order or signup. Entries it creates are stamped with
// BACKFILL_NOTE so a reader's activity list shows why the points
// appeared.
//
// Sources mirror the live flow exactly:
// - Referrals: every ReferralSignup row in the workspace, at the current
//   configured referral value.
// - Products: every paid ProductOrder row, at the row's stored
//   amountCents. Both live product flows (the product checkout and the
//   legacy Payment Link flow) record the session total there and award
//   on it, so the stored amount is the live amount basis.
// - Deals: every CouponBookPurchase row carrying a Stripe checkout
//   session id. Those rows store neither an amount nor (for a gift) the
//   buyer, so the caller resolves each session back to the paid purchase
//   the live flow would have awarded on (session kind, buyer email,
//   session total). Rows with no session (reward redemptions, manual
//   grants) and sessions that do not resolve to a paid book, upgrade, or
//   gift purchase are skipped and counted. Mini guide purchases and
//   Deals subscription renewals earn nothing in the live flow, so they
//   earn nothing here either.

export const BACKFILL_NOTE = "Launch credit for activity before Reader Rewards";

export interface DealsSessionResolution {
  buyerEmail: string;
  amountCents: number;
}

export interface RewardsBackfillResult {
  workspaceId: string;
  readersCredited: number;
  pointsIssued: number;
  referrals: {
    signupsFound: number;
    entriesCreated: number;
    pointsIssued: number;
  };
  productOrders: {
    ordersFound: number;
    entriesCreated: number;
    pointsIssued: number;
  };
  dealsPurchases: {
    purchasesFound: number;
    entriesCreated: number;
    pointsIssued: number;
    skippedNoSession: number;
    skippedUnresolved: number;
  };
}

function purchasePointsFor(amountCents: number, config: RewardConfig): number {
  return (
    Math.floor(Math.max(0, amountCents) / 100) * config.purchasePointsPerDollar
  );
}

async function markReaderCredited(
  db: PrismaClient,
  workspaceId: string,
  email: string,
  credited: Record<string, true>
): Promise<void> {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return;
  const subscriber = await db.subscriber.findFirst({
    where: { workspaceId, email: normalized },
    select: { id: true },
  });
  if (subscriber) credited[subscriber.id] = true;
}

export async function backfillRewards(
  db: PrismaClient,
  args: {
    workspaceId: string;
    resolveDealsSession: (
      sessionId: string
    ) => Promise<DealsSessionResolution | null>;
  }
): Promise<RewardsBackfillResult> {
  const { workspaceId } = args;
  const config = await getRewardConfig(db, workspaceId);
  const credited: Record<string, true> = {};
  const result: RewardsBackfillResult = {
    workspaceId,
    readersCredited: 0,
    pointsIssued: 0,
    referrals: { signupsFound: 0, entriesCreated: 0, pointsIssued: 0 },
    productOrders: { ordersFound: 0, entriesCreated: 0, pointsIssued: 0 },
    dealsPurchases: {
      purchasesFound: 0,
      entriesCreated: 0,
      pointsIssued: 0,
      skippedNoSession: 0,
      skippedUnresolved: 0,
    },
  };

  const signups = await db.referralSignup.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      newSubscriberId: true,
      referralCode: { select: { subscriberId: true } },
    },
  });
  result.referrals.signupsFound = signups.length;
  for (const signup of signups) {
    const awarded = await awardReferralPoints(db, {
      workspaceId,
      referralSignupId: signup.id,
      referrerSubscriberId: signup.referralCode.subscriberId,
      newSubscriberId: signup.newSubscriberId ?? "",
      note: BACKFILL_NOTE,
    });
    if (awarded) {
      result.referrals.entriesCreated += 1;
      result.referrals.pointsIssued += config.referralSignupPoints;
      credited[signup.referralCode.subscriberId] = true;
    }
  }

  const orders = await db.productOrder.findMany({
    where: { workspaceId, status: "paid", stripeSessionId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { email: true, amountCents: true, stripeSessionId: true },
  });
  result.productOrders.ordersFound = orders.length;
  for (const order of orders) {
    if (!order.stripeSessionId) continue;
    const awarded = await awardPurchasePoints(db, {
      workspaceId,
      email: order.email,
      amountCents: order.amountCents,
      sessionId: order.stripeSessionId,
      note: BACKFILL_NOTE,
    });
    if (awarded) {
      result.productOrders.entriesCreated += 1;
      result.productOrders.pointsIssued += purchasePointsFor(
        order.amountCents,
        config
      );
      await markReaderCredited(db, workspaceId, order.email, credited);
    }
  }

  const purchases = await db.couponBookPurchase.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { stripeSessionId: true },
  });
  result.dealsPurchases.purchasesFound = purchases.length;
  for (const purchase of purchases) {
    if (!purchase.stripeSessionId) {
      result.dealsPurchases.skippedNoSession += 1;
      continue;
    }
    const resolved = await args.resolveDealsSession(purchase.stripeSessionId);
    if (!resolved) {
      result.dealsPurchases.skippedUnresolved += 1;
      continue;
    }
    const awarded = await awardPurchasePoints(db, {
      workspaceId,
      email: resolved.buyerEmail,
      amountCents: resolved.amountCents,
      sessionId: purchase.stripeSessionId,
      note: BACKFILL_NOTE,
    });
    if (awarded) {
      result.dealsPurchases.entriesCreated += 1;
      result.dealsPurchases.pointsIssued += purchasePointsFor(
        resolved.amountCents,
        config
      );
      await markReaderCredited(db, workspaceId, resolved.buyerEmail, credited);
    }
  }

  result.pointsIssued =
    result.referrals.pointsIssued +
    result.productOrders.pointsIssued +
    result.dealsPurchases.pointsIssued;
  result.readersCredited = Object.keys(credited).length;
  return result;
}

// The phase-1 catalog is exactly one Gist-owned item. Ensured lazily (the
// getOrCreate pattern used for referral codes and Stripe prices) the first
// time a workspace's rewards surface is read, seeded from the
// rewards_deals_year_cost_points setting; after that the row is the record
// and the setting only matters for workspaces not yet seeded.
export async function ensureDealsYearCatalogItem(
  db: PrismaClient,
  workspaceId: string
) {
  const config = await getRewardConfig(db, workspaceId);
  return db.rewardCatalogItem.upsert({
    where: { workspaceId_key: { workspaceId, key: DEALS_FREE_YEAR_KEY } },
    update: {},
    create: {
      workspaceId,
      key: DEALS_FREE_YEAR_KEY,
      title: "Free Year of The Gist Deals",
      description:
        "A full year of The Gist Deals, on us: every local deal in the book, no card required.",
      costPoints: config.dealsYearCostPoints,
      kind: "deals_year",
      active: true,
    },
  });
}

export interface RewardsSummary {
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  recentEntries: {
    kind: string;
    points: number;
    note: string | null;
    createdAt: Date;
  }[];
}

export async function getRewardsSummary(
  db: PrismaClient,
  workspaceId: string,
  subscriberId: string
): Promise<RewardsSummary> {
  const [earned, spent, recentEntries] = await Promise.all([
    db.rewardPointEntry.aggregate({
      where: { workspaceId, subscriberId, points: { gt: 0 } },
      _sum: { points: true },
    }),
    db.rewardPointEntry.aggregate({
      where: { workspaceId, subscriberId, points: { lt: 0 } },
      _sum: { points: true },
    }),
    db.rewardPointEntry.findMany({
      where: { workspaceId, subscriberId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { kind: true, points: true, note: true, createdAt: true },
    }),
  ]);
  const totalEarned = earned._sum.points ?? 0;
  const totalRedeemed = -(spent._sum.points ?? 0);
  return {
    balance: totalEarned - totalRedeemed,
    totalEarned,
    totalRedeemed,
    recentEntries,
  };
}

export interface DealsAccess {
  hasAccess: boolean;
  isLifetime: boolean;
  accessUntil: Date | null;
}

// Deals ownership is a set of CouponBookPurchase rows for the email; access
// is the same rule the rest of the site uses (active row that is lifetime
// or paid through a future date).
export async function getDealsAccess(
  db: PrismaClient,
  workspaceId: string,
  email: string
): Promise<DealsAccess> {
  const rows = await db.couponBookPurchase.findMany({
    where: { workspaceId, email, active: true },
    select: { isLifetime: true, accessUntil: true },
  });
  let hasAccess = false;
  let isLifetime = false;
  let accessUntil: Date | null = null;
  for (const row of rows) {
    if (!couponBookPurchaseHasAccess(row)) continue;
    hasAccess = true;
    if (row.isLifetime) isLifetime = true;
    if (row.accessUntil && (!accessUntil || row.accessUntil > accessUntil)) {
      accessUntil = row.accessUntil;
    }
  }
  return { hasAccess, isLifetime, accessUntil };
}

export class RewardsError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface RedemptionResult {
  redemptionId: string;
  code: string;
  pointsSpent: number;
  balanceAfter: number;
  accessUntil: Date;
  magicToken: string;
}

// Redeem the free Deals year. One serializable transaction: balance check,
// redemption row, the negative ledger entry, and the Deals grant. The grant
// is the exact shape of a gift purchase (a CouponBookPurchase row, not
// lifetime, access through one prepaid year), stacked on top of any annual
// access the reader already has; lifetime owners are refused because the
// item would buy them nothing. The caller emails the magic link after the
// transaction commits.
export async function redeemCatalogItem(
  db: PrismaClient,
  args: {
    workspaceId: string;
    subscriberId: string;
    email: string;
    itemKey: string;
  }
): Promise<RedemptionResult> {
  const email = args.email.trim().toLowerCase();
  return db.$transaction(
    async (tx) => {
      const item = await tx.rewardCatalogItem.findFirst({
        where: { workspaceId: args.workspaceId, key: args.itemKey, active: true },
      });
      if (!item || item.kind !== "deals_year") {
        throw new RewardsError("item_unavailable", "That reward is not available right now.");
      }
      const balanceAgg = await tx.rewardPointEntry.aggregate({
        where: { workspaceId: args.workspaceId, subscriberId: args.subscriberId },
        _sum: { points: true },
      });
      const balance = balanceAgg._sum.points ?? 0;
      if (balance < item.costPoints) {
        throw new RewardsError(
          "insufficient_points",
          `You need ${item.costPoints} points for this reward; your balance is ${balance}.`
        );
      }
      const rows = await tx.couponBookPurchase.findMany({
        where: { workspaceId: args.workspaceId, email, active: true },
        select: { isLifetime: true, accessUntil: true },
      });
      let currentAnnualEnd: Date | null = null;
      for (const row of rows) {
        if (!couponBookPurchaseHasAccess(row)) continue;
        if (row.isLifetime) {
          throw new RewardsError(
            "already_lifetime",
            "You already have lifetime Deals access, so this reward would buy you nothing."
          );
        }
        if (row.accessUntil && (!currentAnnualEnd || row.accessUntil > currentAnnualEnd)) {
          currentAnnualEnd = row.accessUntil;
        }
      }
      const now = new Date();
      const start =
        currentAnnualEnd && currentAnnualEnd > now ? currentAnnualEnd : now;
      const accessUntil = couponBookPrepaidYearEnd(start);
      const redemption = await tx.rewardRedemption.create({
        data: {
          workspaceId: args.workspaceId,
          subscriberId: args.subscriberId,
          catalogItemId: item.id,
          pointsSpent: item.costPoints,
          status: "fulfilled",
          fulfilledAt: now,
        },
      });
      await tx.rewardPointEntry.create({
        data: {
          workspaceId: args.workspaceId,
          subscriberId: args.subscriberId,
          kind: REWARD_KIND_REDEMPTION,
          points: -item.costPoints,
          sourceRef: redemption.id,
          note: item.title,
        },
      });
      const purchase = await tx.couponBookPurchase.create({
        data: {
          workspaceId: args.workspaceId,
          email,
          active: true,
          isLifetime: false,
          accessUntil,
        },
      });
      return {
        redemptionId: redemption.id,
        code: redemption.code,
        pointsSpent: item.costPoints,
        balanceAfter: balance - item.costPoints,
        accessUntil,
        magicToken: purchase.magicToken,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
