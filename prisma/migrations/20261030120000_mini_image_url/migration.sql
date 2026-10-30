-- Guide cover image (2026-10-30): an optional overall image for a Deals
-- guide (Mini), set in /admin/minis and shown on the guide's teaser page,
-- in the Deals portal, on the shop guide card, and in newsletter
-- spotlight cards. Additive only: every existing row keeps
-- imageUrl = null and renders exactly as before.
ALTER TABLE "Mini" ADD COLUMN "imageUrl" TEXT;
