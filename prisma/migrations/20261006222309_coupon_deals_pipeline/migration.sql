-- Coupon book content engine (Phase 1): weekly retailer deals.
-- Retailer configs per workspace, DealWeek per retailer per week (draft/published),
-- Deal rows (text-only, our own wording, deep-linked), digest send log,
-- and the buyer digest opt-out flag.

CREATE TABLE "Retailer" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL,
    "storeConfig" TEXT NOT NULL DEFAULT '{}',
    "affiliateUrlTemplate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Retailer_workspaceId_slug_key" ON "Retailer"("workspaceId", "slug");
CREATE UNIQUE INDEX "Retailer_id_workspaceId_key" ON "Retailer"("id", "workspaceId");
CREATE INDEX "Retailer_workspaceId_idx" ON "Retailer"("workspaceId");

CREATE TABLE "DealWeek" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "DealWeek_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "DealWeek" ADD CONSTRAINT "DealWeek_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealWeek" ADD CONSTRAINT "DealWeek_retailerId_workspaceId_fkey" FOREIGN KEY ("retailerId", "workspaceId") REFERENCES "Retailer"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "DealWeek_workspaceId_retailerId_weekStart_key" ON "DealWeek"("workspaceId", "retailerId", "weekStart");
CREATE UNIQUE INDEX "DealWeek_id_workspaceId_key" ON "DealWeek"("id", "workspaceId");
CREATE INDEX "DealWeek_workspaceId_status_idx" ON "DealWeek"("workspaceId", "status");

CREATE TABLE "Deal" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "dealWeekId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" TEXT,
    "regPrice" TEXT,
    "category" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "dealUrl" TEXT,
    "businessName" TEXT,
    "validFrom" TEXT,
    "validTo" TEXT,
    "isTopPick" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_dealWeekId_workspaceId_fkey" FOREIGN KEY ("dealWeekId", "workspaceId") REFERENCES "DealWeek"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Deal_id_workspaceId_key" ON "Deal"("id", "workspaceId");
CREATE INDEX "Deal_workspaceId_dealWeekId_idx" ON "Deal"("workspaceId", "dealWeekId");

CREATE TABLE "DealDigestSend" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "dealWeekIds" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "DealDigestSend_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "DealDigestSend" ADD CONSTRAINT "DealDigestSend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "DealDigestSend_id_workspaceId_key" ON "DealDigestSend"("id", "workspaceId");
CREATE INDEX "DealDigestSend_workspaceId_idx" ON "DealDigestSend"("workspaceId");

ALTER TABLE "CouponBookPurchase" ADD COLUMN "digestOptOut" BOOLEAN NOT NULL DEFAULT false;
