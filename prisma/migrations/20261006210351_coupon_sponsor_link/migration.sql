-- Self-serve sponsor coupons: link Coupon to the SponsorProfile that submitted it.
-- NULL sponsorId = created by admin in the coupon book flow. Sponsors get no
-- approval queue: their coupons are created active and show in the book at once.

ALTER TABLE "Coupon" ADD COLUMN "sponsorId" TEXT;
CREATE INDEX "Coupon_sponsorId_idx" ON "Coupon"("sponsorId");
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "SponsorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
