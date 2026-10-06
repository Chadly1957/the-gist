-- Gist Coupon Book MVP: reader purchases, coupons, and redemptions.

CREATE TABLE "CouponBookPurchase" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "buyerToken" TEXT NOT NULL,
    "magicToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponBookPurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CouponBookPurchase_stripeSessionId_key" ON "CouponBookPurchase"("stripeSessionId");
CREATE UNIQUE INDEX "CouponBookPurchase_buyerToken_key" ON "CouponBookPurchase"("buyerToken");
CREATE UNIQUE INDEX "CouponBookPurchase_magicToken_key" ON "CouponBookPurchase"("magicToken");
CREATE UNIQUE INDEX "CouponBookPurchase_id_workspaceId_key" ON "CouponBookPurchase"("id", "workspaceId");
CREATE INDEX "CouponBookPurchase_workspaceId_email_idx" ON "CouponBookPurchase"("workspaceId", "email");
CREATE INDEX "CouponBookPurchase_workspaceId_idx" ON "CouponBookPurchase"("workspaceId");
ALTER TABLE "CouponBookPurchase" ADD CONSTRAINT "CouponBookPurchase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Coupon" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "terms" TEXT NOT NULL DEFAULT '',
    "maxRedemptions" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Coupon_id_workspaceId_key" ON "Coupon"("id", "workspaceId");
CREATE INDEX "Coupon_workspaceId_idx" ON "Coupon"("workspaceId");
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CouponRedemption" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CouponRedemption_id_workspaceId_key" ON "CouponRedemption"("id", "workspaceId");
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX "CouponRedemption_purchaseId_idx" ON "CouponRedemption"("purchaseId");
CREATE INDEX "CouponRedemption_workspaceId_idx" ON "CouponRedemption"("workspaceId");
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CouponBookPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
