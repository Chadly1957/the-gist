-- Per-workspace branding images, manageable from the admin workspaces page.
-- logoUrl: nav logo image (falls back to the bundled per-city logo or text).
-- heroImageUrl: homepage hero photo (falls back to the bundled per-city hero).
ALTER TABLE "Workspace" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "heroImageUrl" TEXT;
