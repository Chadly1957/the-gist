-- Nurture email tracking: per-recipient send rows + click rows so each
-- sponsor nurture campaign can report opens and link clicks, mirroring
-- the newsletter's NewsletterRecipient / LinkClick pattern.

CREATE TABLE "SponsorNurtureSend" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "profileId" TEXT,
    "email" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsorNurtureSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SponsorNurtureSend_id_workspaceId_key" ON "SponsorNurtureSend"("id", "workspaceId");
CREATE INDEX "SponsorNurtureSend_workspaceId_idx" ON "SponsorNurtureSend"("workspaceId");
CREATE INDEX "SponsorNurtureSend_campaignId_idx" ON "SponsorNurtureSend"("campaignId");
ALTER TABLE "SponsorNurtureSend" ADD CONSTRAINT "SponsorNurtureSend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorNurtureSend" ADD CONSTRAINT "SponsorNurtureSend_campaignId_workspaceId_fkey" FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "SponsorEmailCampaign"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SponsorNurtureClick" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "sendId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsorNurtureClick_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SponsorNurtureClick_id_workspaceId_key" ON "SponsorNurtureClick"("id", "workspaceId");
CREATE INDEX "SponsorNurtureClick_workspaceId_idx" ON "SponsorNurtureClick"("workspaceId");
CREATE INDEX "SponsorNurtureClick_sendId_idx" ON "SponsorNurtureClick"("sendId");
ALTER TABLE "SponsorNurtureClick" ADD CONSTRAINT "SponsorNurtureClick_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorNurtureClick" ADD CONSTRAINT "SponsorNurtureClick_sendId_workspaceId_fkey" FOREIGN KEY ("sendId", "workspaceId") REFERENCES "SponsorNurtureSend"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
