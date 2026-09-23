-- Add sponsorAnalyticsSentAt to NewsletterSend so the (now daily) sponsor
-- analytics cron processes each send exactly once.
ALTER TABLE "NewsletterSend" ADD COLUMN "sponsorAnalyticsSentAt" TIMESTAMP(3);
