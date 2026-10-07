-- The Gist Deals branding per workspace: a Deals logo and an email header image,
-- uploaded in workspace settings and used by the buyer portal and digest email.

ALTER TABLE "Workspace" ADD COLUMN "dealsLogoUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "dealsEmailHeaderUrl" TEXT;
