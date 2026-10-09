-- Add onlineRedemption flag to Coupon (email/online booking vs in-store QR scan).
ALTER TABLE "Coupon" ADD COLUMN "onlineRedemption" BOOLEAN NOT NULL DEFAULT false;
