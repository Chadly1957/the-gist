-- Week-based sponsor packages (Presenting $150/wk, Standard $75/wk).
-- SponsorWeek rows double as the lock target for atomic slot assignment.

CREATE TABLE "SponsorWeek" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsorWeek_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SponsorWeek_workspaceId_weekStart_key" ON "SponsorWeek"("workspaceId", "weekStart");
CREATE UNIQUE INDEX "SponsorWeek_id_workspaceId_key" ON "SponsorWeek"("id", "workspaceId");
CREATE INDEX "SponsorWeek_workspaceId_idx" ON "SponsorWeek"("workspaceId");
ALTER TABLE "SponsorWeek" ADD CONSTRAINT "SponsorWeek_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SponsorHold" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "holdToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsorHold_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SponsorHold_holdToken_key" ON "SponsorHold"("holdToken");
CREATE UNIQUE INDEX "SponsorHold_id_workspaceId_key" ON "SponsorHold"("id", "workspaceId");
CREATE INDEX "SponsorHold_workspaceId_idx" ON "SponsorHold"("workspaceId");
CREATE INDEX "SponsorHold_expiresAt_idx" ON "SponsorHold"("expiresAt");
ALTER TABLE "SponsorHold" ADD CONSTRAINT "SponsorHold_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorHold" ADD CONSTRAINT "SponsorHold_weekId_workspaceId_fkey" FOREIGN KEY ("weekId", "workspaceId") REFERENCES "SponsorWeek"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SponsorWeekBooking" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "amountCents" INTEGER NOT NULL,
    "stripeSessionId" TEXT,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "logoUrl" TEXT NOT NULL,
    "aboutText" TEXT NOT NULL,
    "chadWritesCopy" BOOLEAN NOT NULL DEFAULT true,
    "finalAdCopy" TEXT,
    "copyFinalizedAt" TIMESTAMP(3),
    "rebookToken" TEXT NOT NULL,
    "resultsSentAt" TIMESTAMP(3),
    "renewalSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsorWeekBooking_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SponsorWeekBooking_rebookToken_key" ON "SponsorWeekBooking"("rebookToken");
CREATE UNIQUE INDEX "SponsorWeekBooking_id_workspaceId_key" ON "SponsorWeekBooking"("id", "workspaceId");
CREATE INDEX "SponsorWeekBooking_workspaceId_idx" ON "SponsorWeekBooking"("workspaceId");
CREATE INDEX "SponsorWeekBooking_stripeSessionId_idx" ON "SponsorWeekBooking"("stripeSessionId");
CREATE INDEX "SponsorWeekBooking_weekId_idx" ON "SponsorWeekBooking"("weekId");
CREATE INDEX "SponsorWeekBooking_status_idx" ON "SponsorWeekBooking"("status");
ALTER TABLE "SponsorWeekBooking" ADD CONSTRAINT "SponsorWeekBooking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorWeekBooking" ADD CONSTRAINT "SponsorWeekBooking_weekId_workspaceId_fkey" FOREIGN KEY ("weekId", "workspaceId") REFERENCES "SponsorWeek"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorWeekBooking" ADD CONSTRAINT "SponsorWeekBooking_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link projected day rows back to their week booking.
ALTER TABLE "AdBooking" ADD COLUMN "sponsorWeekBookingId" TEXT;
CREATE INDEX "AdBooking_sponsorWeekBookingId_idx" ON "AdBooking"("sponsorWeekBookingId");
ALTER TABLE "AdBooking" ADD CONSTRAINT "AdBooking_sponsorWeekBookingId_workspaceId_fkey" FOREIGN KEY ("sponsorWeekBookingId", "workspaceId") REFERENCES "SponsorWeekBooking"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Track the 4-week Community Board upgrade nudge.
ALTER TABLE "SpotlightListing" ADD COLUMN "upgradeNudgeSentAt" TIMESTAMP(3);
