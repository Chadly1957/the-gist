-- Notification + failure-alert tracking for weekly sponsor bookings.
-- ownerNotifiedAt: the FYI email to Chad sent successfully.
-- buyerNotifiedAt: the buyer confirmation email sent successfully.
-- fulfillmentAlertSentAt: a failure alarm was raised for this booking (prevents repeat alarms).
ALTER TABLE "SponsorWeekBooking" ADD COLUMN "ownerNotifiedAt" TIMESTAMP(3);
ALTER TABLE "SponsorWeekBooking" ADD COLUMN "buyerNotifiedAt" TIMESTAMP(3);
ALTER TABLE "SponsorWeekBooking" ADD COLUMN "fulfillmentAlertSentAt" TIMESTAMP(3);

-- Backfill: bookings paid before this shipped went through the previous
-- webhook path, which attempted both the buyer confirmation and the owner
-- notification on every fulfillment. Mark them notified so the watchdog
-- does not raise false alarms for history.
UPDATE "SponsorWeekBooking"
SET "ownerNotifiedAt" = "paidAt", "buyerNotifiedAt" = "paidAt"
WHERE status = 'paid' AND "paidAt" IS NOT NULL;
