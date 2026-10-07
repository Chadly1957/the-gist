-- Sponsor self-serve deals + renewing coupons.

-- Link a retailer to a sponsor for their own deals section.
ALTER TABLE "Retailer" ADD COLUMN "sponsorId" TEXT;

-- Sponsor deals expire on their cadence (weekly/monthly).
ALTER TABLE "Deal" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Renewing coupons: one redemption per interval, auto-refreshes.
ALTER TABLE "Coupon" ADD COLUMN "refreshInterval" TEXT;
