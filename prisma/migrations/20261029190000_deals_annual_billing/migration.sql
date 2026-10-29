-- Deals annual billing (2026-10-29): NEW book purchases become $15/year
-- Stripe subscriptions (or one prepaid gift year) instead of one-time
-- lifetime buys. Additive only: every existing row keeps isLifetime = true
-- (grandfathered, per the launch promise) and the new columns stay
-- null/false for all pre-existing purchases.
ALTER TABLE "CouponBookPurchase" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "CouponBookPurchase" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "CouponBookPurchase" ADD COLUMN "accessUntil" TIMESTAMP(3);
ALTER TABLE "CouponBookPurchase" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "CouponBookPurchase_stripeSubscriptionId_key" ON "CouponBookPurchase"("stripeSubscriptionId");
