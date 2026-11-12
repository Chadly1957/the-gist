-- Unify sponsor profiles and community listings (2026-11-12).
-- SponsorProfile becomes the single source of truth for a business's
-- public info (businessName, contactName, email, phone, website,
-- logoUrl, description, category); SpotlightListing becomes a thin
-- placement row and every reader takes those fields from the profile.
-- Additive only: two new nullable columns on SponsorProfile plus
-- backfills from each profile's earliest listing (logo, description,
-- website from ctaUrl, category). The duplicated SpotlightListing
-- columns are NOT dropped here: the Vercel build runs `prisma migrate
-- deploy` while the old code is still serving, so dropping columns the
-- old code reads would break live prod during the build window. The
-- column-drop is a follow-up PR after this one is live.
-- Also adds BoardPost.eventId so the admin event -> Board free upgrade
-- (same PR) can stay idempotent and the admin events view can show
-- which events are already on the Board.
ALTER TABLE "SponsorProfile" ADD COLUMN "description" TEXT;
ALTER TABLE "SponsorProfile" ADD COLUMN "category" TEXT;

-- Backfill profile fields from each profile's earliest listing, only
-- where the profile field is empty. DISTINCT ON picks one listing per
-- profile (earliest created); listings always exist per profile because
-- the FK cascades on profile delete.
UPDATE "SponsorProfile" p
SET "description" = sub."description",
    "category" = sub."category"
FROM (
  SELECT DISTINCT ON (l."sponsorId") l."sponsorId", l."description", l."category"
  FROM "SpotlightListing" l
  ORDER BY l."sponsorId", l."createdAt" ASC
) sub
WHERE sub."sponsorId" = p."id" AND p."description" IS NULL;

UPDATE "SponsorProfile" p
SET "logoUrl" = sub."logoUrl"
FROM (
  SELECT DISTINCT ON (l."sponsorId") l."sponsorId", l."logoUrl"
  FROM "SpotlightListing" l
  WHERE l."logoUrl" IS NOT NULL
  ORDER BY l."sponsorId", l."createdAt" ASC
) sub
WHERE sub."sponsorId" = p."id" AND p."logoUrl" IS NULL;

UPDATE "SponsorProfile" p
SET "website" = sub."ctaUrl"
FROM (
  SELECT DISTINCT ON (l."sponsorId") l."sponsorId", l."ctaUrl"
  FROM "SpotlightListing" l
  ORDER BY l."sponsorId", l."createdAt" ASC
) sub
WHERE sub."sponsorId" = p."id" AND p."website" IS NULL;

-- BoardPost.eventId for the admin event -> Community Board free upgrade.
ALTER TABLE "BoardPost" ADD COLUMN "eventId" TEXT;
CREATE INDEX "BoardPost_eventId_idx" ON "BoardPost"("eventId");
