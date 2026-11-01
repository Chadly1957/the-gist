-- AlterTable: optional SEO overrides + a view counter for original articles.
-- All additive and defaulted, safe on existing rows.
ALTER TABLE "Story" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "Story" ADD COLUMN "seoDescription" TEXT;
ALTER TABLE "Story" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
