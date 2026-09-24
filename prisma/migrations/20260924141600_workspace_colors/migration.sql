-- Add per-workspace brand colors so each city can have its own identity.
-- Defaults match the greens The Gist Decatur already uses.
ALTER TABLE "Workspace" ADD COLUMN "primaryColor" TEXT NOT NULL DEFAULT '#15803d';
ALTER TABLE "Workspace" ADD COLUMN "secondaryColor" TEXT NOT NULL DEFAULT '#166534';
