-- Reader Rewards phase 1 (2026-11-20): the points foundation. An
-- append-only ledger (RewardPointEntry; balance is the SUM of a reader's
-- entries), a redemption catalog (RewardCatalogItem, seeded lazily per
-- workspace by lib/rewards.ts with one item: a free year of Deals for
-- 1,500 points), and redemptions (RewardRedemption). Additive only: three
-- new tables plus indexes and their foreign keys; no existing table is
-- touched. The (workspaceId, kind, sourceRef) unique index on the ledger
-- is the idempotency guard for the earn hooks.
-- CreateTable
CREATE TABLE "RewardPointEntry" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceRef" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardPointEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCatalogItem" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "costPoints" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'deals_year',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_fulfillment',
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardPointEntry_id_workspaceId_key" ON "RewardPointEntry"("id", "workspaceId");
CREATE UNIQUE INDEX "RewardPointEntry_workspaceId_kind_sourceRef_key" ON "RewardPointEntry"("workspaceId", "kind", "sourceRef");
CREATE INDEX "RewardPointEntry_workspaceId_subscriberId_createdAt_idx" ON "RewardPointEntry"("workspaceId", "subscriberId", "createdAt");
CREATE INDEX "RewardPointEntry_workspaceId_idx" ON "RewardPointEntry"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardCatalogItem_workspaceId_key_key" ON "RewardCatalogItem"("workspaceId", "key");
CREATE UNIQUE INDEX "RewardCatalogItem_id_workspaceId_key" ON "RewardCatalogItem"("id", "workspaceId");
CREATE INDEX "RewardCatalogItem_workspaceId_active_idx" ON "RewardCatalogItem"("workspaceId", "active");
CREATE INDEX "RewardCatalogItem_workspaceId_idx" ON "RewardCatalogItem"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardRedemption_code_key" ON "RewardRedemption"("code");
CREATE UNIQUE INDEX "RewardRedemption_id_workspaceId_key" ON "RewardRedemption"("id", "workspaceId");
CREATE INDEX "RewardRedemption_workspaceId_subscriberId_createdAt_idx" ON "RewardRedemption"("workspaceId", "subscriberId", "createdAt");
CREATE INDEX "RewardRedemption_workspaceId_status_idx" ON "RewardRedemption"("workspaceId", "status");
CREATE INDEX "RewardRedemption_workspaceId_idx" ON "RewardRedemption"("workspaceId");

-- AddForeignKey
ALTER TABLE "RewardPointEntry" ADD CONSTRAINT "RewardPointEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardCatalogItem" ADD CONSTRAINT "RewardCatalogItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_catalogItemId_workspaceId_fkey" FOREIGN KEY ("catalogItemId", "workspaceId") REFERENCES "RewardCatalogItem"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
