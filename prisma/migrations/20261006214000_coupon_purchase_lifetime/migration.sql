-- Coupon book is a flat $15 one-time purchase (founding/regular tiers removed).
-- Mark one-time buyers as lifetime so they can be grandfathered in free if the
-- book ever moves to a subscription model.
ALTER TABLE "CouponBookPurchase" ADD COLUMN "isLifetime" BOOLEAN NOT NULL DEFAULT true;
