-- One person can own several businesses: drop the workspace+email unique
-- constraint on SponsorProfile so the same email can hold multiple profiles
-- (one per business). Find-or-create flows now match on email + business name.
DROP INDEX "SponsorProfile_workspaceId_email_key";
CREATE INDEX "SponsorProfile_workspaceId_email_idx" ON "SponsorProfile"("workspaceId", "email");
