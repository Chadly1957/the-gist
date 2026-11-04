-- AlterTable: section tag for original articles. "news" renders at
-- /articles; "local" is the evergreen SEO route at /local. Existing rows
-- are all news, which is exactly what the default says.
ALTER TABLE "Story" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'news';
