-- Starred Community Board placements (2026-11-16): a paid $39.99/mo
-- subscription that pins a business's Community Partner listing at the
-- top of the Community Partners block in every daily issue. Cap is 5
-- live subscriptions per workspace, enforced at checkout in a locked
-- transaction (not in the schema). Additive only: one new table plus
-- indexes; no existing table is touched. The partial unique index is
-- the one guard the Prisma schema cannot express: one listing can hold
-- at most one live subscription (pending_payment | active | past_due).
-- CreateTable
CREATE TABLE "StarredBoardSubscription" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "spotlightId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "monthlyAmountCents" INTEGER NOT NULL DEFAULT 3999,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSessionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StarredBoardSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StarredBoardSubscription_stripeSubscriptionId_key" ON "StarredBoardSubscription"("stripeSubscriptionId");
CREATE UNIQUE INDEX "StarredBoardSubscription_stripeSessionId_key" ON "StarredBoardSubscription"("stripeSessionId");
CREATE UNIQUE INDEX "StarredBoardSubscription_id_workspaceId_key" ON "StarredBoardSubscription"("id", "workspaceId");
CREATE INDEX "StarredBoardSubscription_workspaceId_status_idx" ON "StarredBoardSubscription"("workspaceId", "status");
CREATE INDEX "StarredBoardSubscription_workspaceId_spotlightId_idx" ON "StarredBoardSubscription"("workspaceId", "spotlightId");
CREATE INDEX "StarredBoardSubscription_spotlightId_idx" ON "StarredBoardSubscription"("spotlightId");
CREATE INDEX "StarredBoardSubscription_stripeCustomerId_idx" ON "StarredBoardSubscription"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "StarredBoardSubscription" ADD CONSTRAINT "StarredBoardSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StarredBoardSubscription" ADD CONSTRAINT "StarredBoardSubscription_spotlightId_workspaceId_fkey" FOREIGN KEY ("spotlightId", "workspaceId") REFERENCES "SpotlightListing"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StarredBoardSubscription" ADD CONSTRAINT "StarredBoardSubscription_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- One live subscription per listing (pending_payment | active | past_due).
CREATE UNIQUE INDEX "StarredBoardSubscription_spotlight_live_unique" ON "StarredBoardSubscription"("workspaceId", "spotlightId") WHERE status IN ('pending_payment', 'active', 'past_due');
