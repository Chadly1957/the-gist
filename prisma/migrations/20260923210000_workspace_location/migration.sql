-- Add location fields to Workspace so location-dependent features
-- (weather block, etc.) can resolve per-city instead of per-block.
ALTER TABLE "Workspace" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Workspace" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Workspace" ADD COLUMN "timezone" TEXT;

-- Backfill workspaces created before location support existed.
-- (The only production workspace at the time of this migration is Decatur.)
UPDATE "Workspace"
SET "latitude" = 39.8403,
    "longitude" = -88.9454,
    "timezone" = 'America/Chicago'
WHERE "latitude" IS NULL;
