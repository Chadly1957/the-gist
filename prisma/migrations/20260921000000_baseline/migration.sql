-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "keywords" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "articleUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blocks" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSend" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "htmlSnapshot" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'sent',

    CONSTRAINT "NewsletterSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSendSpotlight" (
    "id" TEXT NOT NULL,
    "newsletterSendId" TEXT NOT NULL,
    "spotlightId" TEXT NOT NULL,

    CONSTRAINT "NewsletterSendSpotlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterRecipient" (
    "id" TEXT NOT NULL,
    "newsletterSendId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "email" TEXT NOT NULL,
    "resendEmailId" TEXT,
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "newsletterRecipientId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorProfile" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "magicToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpotlightListing" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Visit Website',
    "ctaUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastShownAt" TIMESTAMP(3),
    "shownCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "SpotlightListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdBooking" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "discountPct" INTEGER NOT NULL DEFAULT 0,
    "stripeSessionId" TEXT,
    "imageUrl" TEXT,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaUrl" TEXT NOT NULL,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Learn More',
    "presentingBlurb" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "AdBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSponsorEvent" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSponsorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventDate" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "url" TEXT,
    "cost" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sponsorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralSprint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "goal" INTEGER NOT NULL DEFAULT 5,
    "prizeDescription" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "winnerEmail" TEXT,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralSprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralSignup" (
    "id" TEXT NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "newSubscriberId" TEXT,
    "sprintId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordyWord" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "puzzleNum" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordyWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordyBooking" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "ctaUrl" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT 'Learn More',
    "imageUrl" TEXT,
    "presentingBlurb" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "stripeSessionId" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "WordyBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordyPlay" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "recipientId" TEXT,
    "won" BOOLEAN NOT NULL,
    "guesses" INTEGER NOT NULL,
    "maxGuesses" INTEGER NOT NULL,
    "wordLength" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordyPlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScore" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "newsletterSendId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "recipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'web',
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Article_articleUrl_key" ON "Article"("articleUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "NewsletterSendSpotlight_newsletterSendId_idx" ON "NewsletterSendSpotlight"("newsletterSendId");

-- CreateIndex
CREATE INDEX "NewsletterSendSpotlight_spotlightId_idx" ON "NewsletterSendSpotlight"("spotlightId");

-- CreateIndex
CREATE INDEX "NewsletterRecipient_newsletterSendId_idx" ON "NewsletterRecipient"("newsletterSendId");

-- CreateIndex
CREATE INDEX "LinkClick_newsletterRecipientId_idx" ON "LinkClick"("newsletterRecipientId");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorProfile_email_key" ON "SponsorProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorProfile_magicToken_key" ON "SponsorProfile"("magicToken");

-- CreateIndex
CREATE INDEX "AdBooking_stripeSessionId_idx" ON "AdBooking"("stripeSessionId");

-- CreateIndex
CREATE INDEX "GameSponsorEvent_date_idx" ON "GameSponsorEvent"("date");

-- CreateIndex
CREATE INDEX "GameSponsorEvent_bookingId_idx" ON "GameSponsorEvent"("bookingId");

-- CreateIndex
CREATE INDEX "GameSponsorEvent_game_idx" ON "GameSponsorEvent"("game");

-- CreateIndex
CREATE INDEX "Event_sponsorId_idx" ON "Event"("sponsorId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_subscriberId_key" ON "ReferralCode"("subscriberId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCode_code_idx" ON "ReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralSignup_referralCodeId_idx" ON "ReferralSignup"("referralCodeId");

-- CreateIndex
CREATE INDEX "ReferralSignup_sprintId_idx" ON "ReferralSignup"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "WordyWord_date_key" ON "WordyWord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WordyBooking_date_key" ON "WordyBooking"("date");

-- CreateIndex
CREATE INDEX "WordyBooking_sponsorId_idx" ON "WordyBooking"("sponsorId");

-- CreateIndex
CREATE INDEX "WordyBooking_stripeSessionId_idx" ON "WordyBooking"("stripeSessionId");

-- CreateIndex
CREATE INDEX "WordyPlay_date_idx" ON "WordyPlay"("date");

-- CreateIndex
CREATE INDEX "MatchScore_date_idx" ON "MatchScore"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MatchScore_date_deviceId_key" ON "MatchScore"("date", "deviceId");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_pollId_idx" ON "PollVote"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_optionId_idx" ON "PollVote"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_recipientId_key" ON "PollVote"("pollId", "recipientId");

-- CreateIndex
CREATE INDEX "Tip_stripeSessionId_idx" ON "Tip"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Tip_status_idx" ON "Tip"("status");

-- AddForeignKey
ALTER TABLE "NewsletterSendSpotlight" ADD CONSTRAINT "NewsletterSendSpotlight_newsletterSendId_fkey" FOREIGN KEY ("newsletterSendId") REFERENCES "NewsletterSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterSendSpotlight" ADD CONSTRAINT "NewsletterSendSpotlight_spotlightId_fkey" FOREIGN KEY ("spotlightId") REFERENCES "SpotlightListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsletterRecipient" ADD CONSTRAINT "NewsletterRecipient_newsletterSendId_fkey" FOREIGN KEY ("newsletterSendId") REFERENCES "NewsletterSend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_newsletterRecipientId_fkey" FOREIGN KEY ("newsletterRecipientId") REFERENCES "NewsletterRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpotlightListing" ADD CONSTRAINT "SpotlightListing_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "SponsorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdBooking" ADD CONSTRAINT "AdBooking_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "SponsorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSponsorEvent" ADD CONSTRAINT "GameSponsorEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "AdBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "SponsorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralSignup" ADD CONSTRAINT "ReferralSignup_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "ReferralSprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordyBooking" ADD CONSTRAINT "WordyBooking_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "SponsorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
