BEGIN;
-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Workspace" ("id", "slug", "name", "area") VALUES ('decatur', 'decatur', 'The Gist Decatur', 'Decatur');

-- DropForeignKey
ALTER TABLE "NewsletterSendSpotlight" DROP CONSTRAINT "NewsletterSendSpotlight_newsletterSendId_fkey";

-- DropForeignKey
ALTER TABLE "NewsletterSendSpotlight" DROP CONSTRAINT "NewsletterSendSpotlight_spotlightId_fkey";

-- DropForeignKey
ALTER TABLE "NewsletterRecipient" DROP CONSTRAINT "NewsletterRecipient_newsletterSendId_fkey";

-- DropForeignKey
ALTER TABLE "LinkClick" DROP CONSTRAINT "LinkClick_newsletterRecipientId_fkey";

-- DropForeignKey
ALTER TABLE "SpotlightListing" DROP CONSTRAINT "SpotlightListing_sponsorId_fkey";

-- DropForeignKey
ALTER TABLE "AdBooking" DROP CONSTRAINT "AdBooking_sponsorId_fkey";

-- DropForeignKey
ALTER TABLE "GameSponsorEvent" DROP CONSTRAINT "GameSponsorEvent_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_sponsorId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralSignup" DROP CONSTRAINT "ReferralSignup_referralCodeId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralSignup" DROP CONSTRAINT "ReferralSignup_sprintId_fkey";

-- DropForeignKey
ALTER TABLE "WordyBooking" DROP CONSTRAINT "WordyBooking_sponsorId_fkey";

-- DropForeignKey
ALTER TABLE "PollOption" DROP CONSTRAINT "PollOption_pollId_fkey";

-- DropForeignKey
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_pollId_fkey";

-- DropForeignKey
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_optionId_fkey";

-- DropIndex
DROP INDEX "Source_url_key";

-- DropIndex
DROP INDEX "Article_articleUrl_key";

-- DropIndex
DROP INDEX "Subscriber_email_key";

-- DropIndex
DROP INDEX "Setting_key_key";

-- DropIndex
DROP INDEX "SponsorProfile_email_key";

-- DropIndex
DROP INDEX "WordyWord_date_key";

-- DropIndex
DROP INDEX "WordyBooking_date_key";

-- DropIndex
DROP INDEX "MatchScore_date_deviceId_key";

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "Subscriber" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "NewsletterSend" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "NewsletterSendSpotlight" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "NewsletterRecipient" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "LinkClick" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "SponsorProfile" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "SpotlightListing" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "AdBooking" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "GameSponsorEvent" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "ReferralSprint" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "ReferralCode" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "ReferralSignup" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "WordyWord" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "WordyBooking" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "WordyPlay" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "MatchScore" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "PollOption" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "PollVote" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';

-- AlterTable
ALTER TABLE "Tip" ADD COLUMN     "workspaceId" TEXT NOT NULL DEFAULT 'decatur';



-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_domain_key" ON "Workspace"("domain");

-- CreateIndex
CREATE INDEX "Source_workspaceId_idx" ON "Source"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_workspaceId_url_key" ON "Source"("workspaceId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "Source_id_workspaceId_key" ON "Source"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Article_workspaceId_idx" ON "Article"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Article_workspaceId_articleUrl_key" ON "Article"("workspaceId", "articleUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Article_id_workspaceId_key" ON "Article"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Template_workspaceId_idx" ON "Template"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Template_id_workspaceId_key" ON "Template"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Subscriber_workspaceId_idx" ON "Subscriber"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_workspaceId_email_key" ON "Subscriber"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_id_workspaceId_key" ON "Subscriber"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Setting_workspaceId_idx" ON "Setting"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_workspaceId_key_key" ON "Setting"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_id_workspaceId_key" ON "Setting"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "NewsletterSend_workspaceId_idx" ON "NewsletterSend"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSend_id_workspaceId_key" ON "NewsletterSend"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "NewsletterSendSpotlight_workspaceId_idx" ON "NewsletterSendSpotlight"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSendSpotlight_id_workspaceId_key" ON "NewsletterSendSpotlight"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "NewsletterRecipient_workspaceId_idx" ON "NewsletterRecipient"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterRecipient_id_workspaceId_key" ON "NewsletterRecipient"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "LinkClick_workspaceId_idx" ON "LinkClick"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkClick_id_workspaceId_key" ON "LinkClick"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "SponsorProfile_workspaceId_idx" ON "SponsorProfile"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorProfile_workspaceId_email_key" ON "SponsorProfile"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorProfile_id_workspaceId_key" ON "SponsorProfile"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "SpotlightListing_workspaceId_idx" ON "SpotlightListing"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SpotlightListing_id_workspaceId_key" ON "SpotlightListing"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "AdBooking_workspaceId_idx" ON "AdBooking"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "AdBooking_id_workspaceId_key" ON "AdBooking"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "GameSponsorEvent_workspaceId_idx" ON "GameSponsorEvent"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSponsorEvent_id_workspaceId_key" ON "GameSponsorEvent"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Event_workspaceId_idx" ON "Event"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_id_workspaceId_key" ON "Event"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "ReferralSprint_workspaceId_idx" ON "ReferralSprint"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralSprint_id_workspaceId_key" ON "ReferralSprint"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "ReferralCode_workspaceId_idx" ON "ReferralCode"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_id_workspaceId_key" ON "ReferralCode"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "ReferralSignup_workspaceId_idx" ON "ReferralSignup"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralSignup_id_workspaceId_key" ON "ReferralSignup"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "WordyWord_workspaceId_idx" ON "WordyWord"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WordyWord_workspaceId_date_key" ON "WordyWord"("workspaceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WordyWord_id_workspaceId_key" ON "WordyWord"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "WordyBooking_workspaceId_idx" ON "WordyBooking"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WordyBooking_workspaceId_date_key" ON "WordyBooking"("workspaceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WordyBooking_id_workspaceId_key" ON "WordyBooking"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "WordyPlay_workspaceId_idx" ON "WordyPlay"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WordyPlay_id_workspaceId_key" ON "WordyPlay"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "MatchScore_workspaceId_idx" ON "MatchScore"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchScore_workspaceId_date_deviceId_key" ON "MatchScore"("workspaceId", "date", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchScore_id_workspaceId_key" ON "MatchScore"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Poll_workspaceId_idx" ON "Poll"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Poll_id_workspaceId_key" ON "Poll"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "PollOption_workspaceId_idx" ON "PollOption"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PollOption_id_workspaceId_key" ON "PollOption"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "PollVote_workspaceId_idx" ON "PollVote"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_id_workspaceId_key" ON "PollVote"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Tip_workspaceId_idx" ON "Tip"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_id_workspaceId_key" ON "Tip"("id", "workspaceId");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscriber" ADD CONSTRAINT "Subscriber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSend" ADD CONSTRAINT "NewsletterSend_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSendSpotlight" ADD CONSTRAINT "NewsletterSendSpotlight_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSendSpotlight" ADD CONSTRAINT "NewsletterSendSpotlight_newsletterSendId_workspaceId_fkey" FOREIGN KEY ("newsletterSendId", "workspaceId") REFERENCES "NewsletterSend"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSendSpotlight" ADD CONSTRAINT "NewsletterSendSpotlight_spotlightId_workspaceId_fkey" FOREIGN KEY ("spotlightId", "workspaceId") REFERENCES "SpotlightListing"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterRecipient" ADD CONSTRAINT "NewsletterRecipient_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterRecipient" ADD CONSTRAINT "NewsletterRecipient_newsletterSendId_workspaceId_fkey" FOREIGN KEY ("newsletterSendId", "workspaceId") REFERENCES "NewsletterSend"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_newsletterRecipientId_workspaceId_fkey" FOREIGN KEY ("newsletterRecipientId", "workspaceId") REFERENCES "NewsletterRecipient"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsorProfile" ADD CONSTRAINT "SponsorProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotlightListing" ADD CONSTRAINT "SpotlightListing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotlightListing" ADD CONSTRAINT "SpotlightListing_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdBooking" ADD CONSTRAINT "AdBooking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdBooking" ADD CONSTRAINT "AdBooking_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSponsorEvent" ADD CONSTRAINT "GameSponsorEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSponsorEvent" ADD CONSTRAINT "GameSponsorEvent_bookingId_workspaceId_fkey" FOREIGN KEY ("bookingId", "workspaceId") REFERENCES "AdBooking"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSprint" ADD CONSTRAINT "ReferralSprint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_referralCodeId_workspaceId_fkey" FOREIGN KEY ("referralCodeId", "workspaceId") REFERENCES "ReferralCode"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_sprintId_workspaceId_fkey" FOREIGN KEY ("sprintId", "workspaceId") REFERENCES "ReferralSprint"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordyWord" ADD CONSTRAINT "WordyWord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordyBooking" ADD CONSTRAINT "WordyBooking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordyBooking" ADD CONSTRAINT "WordyBooking_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordyPlay" ADD CONSTRAINT "WordyPlay_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScore" ADD CONSTRAINT "MatchScore_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_workspaceId_fkey" FOREIGN KEY ("pollId", "workspaceId") REFERENCES "Poll"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_workspaceId_fkey" FOREIGN KEY ("pollId", "workspaceId") REFERENCES "Poll"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_workspaceId_fkey" FOREIGN KEY ("optionId", "workspaceId") REFERENCES "PollOption"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
