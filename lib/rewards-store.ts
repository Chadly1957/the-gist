import { Prisma, type PrismaClient } from "@prisma/client";
import {
  couponBookPrepaidYearEnd,
  couponBookPriceCents,
  couponBookPurchaseHasAccess,
} from "@/lib/coupon-book";
import {
  RewardsError,
  debitPointsForCheckout,
  getPointsBalance,
} from "@/lib/rewards";

// Reader Rewards storefront: the rewards portal lists everything a reader
// can buy in the current workspace (the Deals book plus every active
// Product) and lets them pay with points, cash, or a mix. This module is
// the shared read model (what is for sale, at what price, still available)
// and the two fully-points-paid fulfillments. Partial-points and
// cash-only purchases go through the normal Stripe checkouts (see
// app/api/rewards/store/checkout/route.ts), so there is exactly one
// fulfillment path per item type: the webhook for Stripe payments, and
// the two functions below for $0-cash purchases, which record the same
// rows the webhook would have written.
//
// Every function takes the UNSCOPED client plus an explicit workspaceId,
// matching lib/rewards.ts: the portal routes resolve the reader and the
// workspace themselves.

export interface StorefrontItem {
  type: "deals" | "product";
  // Products only; the Deals book is a singleton per workspace.
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

// Everything for sale in this workspace right now: the Deals book first,
// then active products newest first (the public /products order).
// Availability mirrors the public pages exactly: a capped product is
// sold out when PAID orders reach its quantity (points-paid orders are
// paid orders, so they count the moment they land).
export async function listStorefrontItems(
  db: PrismaClient,
  workspaceId: string,
  workspaceName: string
): Promise<StorefrontItem[]> {
  const products = await db.product.findMany({
    where: { workspaceId, status: "active" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tagline: true,
      priceCents: true,
      imageUrl: true,
      quantity: true,
      offersSizes: true,
      requiresShipping: true,
    },
  });
  const paidCounts = await db.productOrder.groupBy({
    by: ["productId"],
    where: { workspaceId, status: "paid" },
    _count: { _all: true },
  });
  const paidById: Record<string, number> = {};
  for (const row of paidCounts) paidById[row.productId] = row._count._all;

  const items: StorefrontItem[] = [
    {
      type: "deals",
      productId: null,
      name: `${workspaceName} Deals Book`,
      tagline: "$15 a year: new deals every Monday, every guide included.",
      priceCents: couponBookPriceCents(),
      imageUrl: null,
      soldOut: false,
      remaining: null,
      offersSizes: false,
      requiresShipping: false,
    },
  ];
  for (const p of products) {
    const paid = paidById[p.id] ?? 0;
    items.push({
      type: "product",
      productId: p.id,
      name: p.name,
      tagline: p.tagline,
      priceCents: p.priceCents,
      imageUrl: p.imageUrl,
      soldOut: p.quantity !== null && paid >= p.quantity,
      remaining: p.quantity !== null ? Math.max(0, p.quantity - paid) : null,
      offersSizes: p.offersSizes,
      requiresShipping: p.requiresShipping,
    });
  }
  return items;
}

export interface PointsPaidProductResult {
  orderId: string;
  pointsSpent: number;
  balanceAfter: number;
}

// Fulfill a product purchase paid entirely with points. One serializable
// transaction: balance check, cap check, the paid order row, and the
// ledger debit (sourceRef = the order id, since there is no Stripe
// session). The order row is exactly what the webhook's fulfillment
// produces for a paid order, with amountCents 0 (no cash changed hands)
// and pointsApplied recording the spend, so caps, admin order lists, and
// fulfillment queues all treat it as a normal paid order. No purchase
// points are earned: the cash portion is $0.
export async function fulfillPointsPaidProduct(
  db: PrismaClient,
  args: {
    workspaceId: string;
    subscriberId: string;
    email: string;
    productId: string;
    size: string | null;
    points: number;
  }
): Promise<PointsPaidProductResult> {
  const email = args.email.trim().toLowerCase();
  return db.$transaction(
    async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: args.productId, workspaceId: args.workspaceId, status: "active" },
        select: { id: true, name: true, quantity: true },
      });
      if (!product) {
        throw new RewardsError("item_unavailable", "That product is not available right now.");
      }
      if (product.quantity !== null) {
        const paid = await tx.productOrder.count({
          where: { workspaceId: args.workspaceId, productId: product.id, status: "paid" },
        });
        if (paid >= product.quantity) {
          throw new RewardsError("sold_out", "This product is sold out.");
        }
      }
      const order = await tx.productOrder.create({
        data: {
          workspaceId: args.workspaceId,
          productId: product.id,
          email,
          amountCents: 0,
          pointsApplied: args.points,
          stripeSessionId: null,
          status: "paid",
          paidAt: new Date(),
          size: args.size,
        },
      });
      await debitPointsForCheckout(tx, {
        workspaceId: args.workspaceId,
        subscriberId: args.subscriberId,
        points: args.points,
        sourceRef: order.id,
        note: product.name,
      });
      const balanceAfter = await getPointsBalance(
        tx,
        args.workspaceId,
        args.subscriberId
      );
      return { orderId: order.id, pointsSpent: args.points, balanceAfter };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export interface PointsPaidDealsResult {
  purchaseId: string;
  pointsSpent: number;
  balanceAfter: number;
  accessUntil: Date;
  magicToken: string;
}

// Fulfill a Deals book purchase paid entirely with points: one prepaid
// year, the exact row shape of a gift purchase (and of the free-year
// catalog redemption), stacked on top of any annual access the reader
// already has. Lifetime owners are refused because the year would buy
// them nothing. One serializable transaction: balance check, the
// purchase row, and the ledger debit (sourceRef = the purchase id). The
// caller emails the magic link after the transaction commits. No
// purchase points are earned: the cash portion is $0.
export async function fulfillPointsPaidDealsYear(
  db: PrismaClient,
  args: {
    workspaceId: string;
    subscriberId: string;
    email: string;
    points: number;
  }
): Promise<PointsPaidDealsResult> {
  const email = args.email.trim().toLowerCase();
  return db.$transaction(
    async (tx) => {
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
            "You already have lifetime Deals access, so this would buy you nothing."
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
      const purchase = await tx.couponBookPurchase.create({
        data: {
          workspaceId: args.workspaceId,
          email,
          active: true,
          isLifetime: false,
          accessUntil,
          pointsApplied: args.points,
        },
      });
      await debitPointsForCheckout(tx, {
        workspaceId: args.workspaceId,
        subscriberId: args.subscriberId,
        points: args.points,
        sourceRef: purchase.id,
        note: "Deals Book (points)",
      });
      const balanceAfter = await getPointsBalance(
        tx,
        args.workspaceId,
        args.subscriberId
      );
      return {
        purchaseId: purchase.id,
        pointsSpent: args.points,
        balanceAfter,
        accessUntil,
        magicToken: purchase.magicToken,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
