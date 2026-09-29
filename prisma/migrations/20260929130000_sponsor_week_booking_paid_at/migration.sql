-- Payment timestamp for week bookings (billing history needs a pay date).
ALTER TABLE "SponsorWeekBooking" ADD COLUMN "paidAt" TIMESTAMP(3);
