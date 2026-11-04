-- Sponsor Amp Kit send log: one row per kit email sent to a sponsor
-- from the admin sponsors page (flyer, QR code, and graphics attached).
-- Additive only; no existing table is touched.

CREATE TABLE "SponsorKitSend" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subject" TEXT NOT NULL,
    "attachmentNames" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SponsorKitSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SponsorKitSend_id_workspaceId_key" ON "SponsorKitSend"("id", "workspaceId");
CREATE INDEX "SponsorKitSend_workspaceId_idx" ON "SponsorKitSend"("workspaceId");
CREATE INDEX "SponsorKitSend_sponsorId_idx" ON "SponsorKitSend"("sponsorId");
ALTER TABLE "SponsorKitSend" ADD CONSTRAINT "SponsorKitSend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorKitSend" ADD CONSTRAINT "SponsorKitSend_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
