-- Per-city canonical domains (spec section 13). All generated links
-- (sponsor portal tokens, referral links, email links) are built by
-- getWorkspaceUrl(), which uses the workspace's domain when set and falls
-- back to NEXT_PUBLIC_APP_URL (the vercel.app deployment URL) otherwise.
-- Point the Decatur workspace at the canonical domain so no user-facing
-- link ever carries a vercel.app URL again.
-- When the Effingham workspace is created, set its domain to
-- 'thegisteffingham.com' the same way; per-city links are then automatic
-- through the existing hostname -> workspace middleware.
UPDATE "Workspace"
SET domain = 'thegistdecatur.com'
WHERE id = 'decatur' AND (domain IS NULL OR domain = '');
