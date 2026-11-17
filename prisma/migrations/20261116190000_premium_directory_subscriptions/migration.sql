-- Premium Directory Placements (2026-11-16): a paid $19.99/mo
-- subscription that pins a business's Community Partner listing at the
-- top of the Partners directory page (/partners) while the subscription
-- is live. Spots are unlimited per workspace (no cap, enforced nowhere).
-- Additive only: one new table plus indexes; no existing table is
-- touched. The partial unique index is the one guard the Prisma schema
-- cannot express: one listing can hold at most one live subscription
-- (pending_payment | active | past_due).
-- CreateTable
CREATE TABLE "PremiumDirectorySubscription" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "spotlightId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "monthlyAmountCents" INTEGER NOT NULL DEFAULT 1999,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSessionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumDirectorySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PremiumDirectorySubscription_stripeSubscriptionId_key" ON "PremiumDirectorySubscription"("stripeSubscriptionId");
CREATE UNIQUE INDEX "PremiumDirectorySubscription_stripeSessionId_key" ON "PremiumDirectorySubscription"("stripeSessionId");
CREATE UNIQUE INDEX "PremiumDirectorySubscription_id_workspaceId_key" ON "PremiumDirectorySubscription"("id", "workspaceId");
CREATE INDEX "PremiumDirectorySubscription_workspaceId_status_idx" ON "PremiumDirectorySubscription"("workspaceId", "status");
CREATE INDEX "PremiumDirectorySubscription_workspaceId_spotlightId_idx" ON "PremiumDirectorySubscription"("workspaceId", "spotlightId");
CREATE INDEX "PremiumDirectorySubscription_spotlightId_idx" ON "PremiumDirectorySubscription"("spotlightId");
CREATE INDEX "PremiumDirectorySubscription_stripeCustomerId_idx" ON "PremiumDirectorySubscription"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "PremiumDirectorySubscription" ADD CONSTRAINT "PremiumDirectorySubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PremiumDirectorySubscription" ADD CONSTRAINT "PremiumDirectorySubscription_spotlightId_workspaceId_fkey" FOREIGN KEY ("spotlightId", "workspaceId") REFERENCES "SpotlightListing"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PremiumDirectorySubscription" ADD CONSTRAINT "PremiumDirectorySubscription_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- One live subscription per listing (pending_payment | active | past_due).
CREATE UNIQUE INDEX "PremiumDirectorySubscription_spotlight_live_unique" ON "PremiumDirectorySubscription"("workspaceId", "spotlightId") WHERE status IN ('pending_payment', 'active', 'past_due');
