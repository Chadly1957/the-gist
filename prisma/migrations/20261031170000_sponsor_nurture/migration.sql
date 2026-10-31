-- Sponsor nurture emails: base templates + per-send campaigns for bulk
-- email to free businesses (Admin > Sponsors > Nurture), plus a nurture
-- opt-out flag on sponsor profiles.

ALTER TABLE "SponsorProfile" ADD COLUMN "nurtureOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SponsorEmailTemplate" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SponsorEmailTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SponsorEmailTemplate_id_workspaceId_key" ON "SponsorEmailTemplate"("id", "workspaceId");
CREATE INDEX "SponsorEmailTemplate_workspaceId_idx" ON "SponsorEmailTemplate"("workspaceId");
ALTER TABLE "SponsorEmailTemplate" ADD CONSTRAINT "SponsorEmailTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SponsorEmailCampaign" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "audience" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SponsorEmailCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SponsorEmailCampaign_id_workspaceId_key" ON "SponsorEmailCampaign"("id", "workspaceId");
CREATE INDEX "SponsorEmailCampaign_workspaceId_idx" ON "SponsorEmailCampaign"("workspaceId");
ALTER TABLE "SponsorEmailCampaign" ADD CONSTRAINT "SponsorEmailCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
