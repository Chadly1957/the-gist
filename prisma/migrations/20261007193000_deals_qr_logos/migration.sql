-- Per-coupon QR redemption flow + retailer brand logos for the bento UI.

ALTER TABLE "Retailer" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "CouponRedemption" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';
