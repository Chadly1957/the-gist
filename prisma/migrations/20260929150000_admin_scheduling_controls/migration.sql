-- Admin scheduling & inventory controls (spec section 12).
-- isComp: $0 comp/house placement on an AdBooking row. Shown as Comp/House
-- in admin only; the newsletter renders it like any other ad.
ALTER TABLE "AdBooking" ADD COLUMN "isComp" BOOLEAN NOT NULL DEFAULT false;

-- Per-issue standard-slot override. The "2 Standard slots per newsletter"
-- limit is a soft cap: admin can raise it for a given date to run extra
-- standard slots (house fills or overbooking). The send pipeline reads this
-- first and falls back to the in_article_count setting.
CREATE TABLE "SponsorDayConfig" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "date" TEXT NOT NULL,
    "maxInArticle" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SponsorDayConfig_pkey" PRIMARY KEY ("workspaceId", "date")
);

-- Enforce the Prisma relation: configs always reference a real workspace.
ALTER TABLE "SponsorDayConfig" ADD CONSTRAINT "SponsorDayConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
