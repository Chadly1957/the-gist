import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getWorkspaceUrl } from "@/lib/workspace";
import { PARTNER_CATEGORIES } from "@/lib/partner-categories";
import { getPartnerDirectory } from "@/lib/partners-directory";
import {
  LOCAL_CATEGORY_INDEX_MIN,
  isLocalCategorySlug,
} from "@/lib/local-seo";

export const dynamic = "force-dynamic";

// Per-host sitemap, served at /sitemap.xml on every domain. The workspace
// resolves from the request host (same helper as the RSS feed), so each
// city domain lists only its own public pages and published articles.
// Drafts are never included. News stories live at /articles/<slug>;
// evergreen stories and directory category pages live under /local, and
// a category page only earns a sitemap entry once it has enough live
// listings to be real content (see lib/local-seo.ts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const stories = await prisma.story.findMany({
    where: { status: "published", section: "news" },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, updatedAt: true },
    take: 500,
  });
  const localStories = await prisma.story.findMany({
    where: { status: "published", section: "local" },
    orderBy: { updatedAt: "desc" },
    select: { slug: true, updatedAt: true },
    take: 500,
  });

  const { byCategory } = await getPartnerDirectory();
  const categoryPaths: Array<{
    path: string;
    priority: number;
    changeFrequency: "weekly";
    lastModified: Date;
  }> = [];
  for (const cat of PARTNER_CATEGORIES) {
    if (!isLocalCategorySlug(cat.slug)) continue;
    const items = byCategory.get(cat.slug) ?? [];
    if (items.length < LOCAL_CATEGORY_INDEX_MIN) continue;
    // Listings carry no updatedAt; the freshest approval (or creation)
    // in the category is the honest last-change signal.
    const lastModified = items.reduce((max, i) => {
      const d = i.approvedAt ?? i.createdAt;
      return d > max ? d : max;
    }, new Date(0));
    categoryPaths.push({
      path: `/local/${cat.slug}`,
      priority: 0.7,
      changeFrequency: "weekly",
      lastModified,
    });
  }

  const staticPaths: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/articles", priority: 0.9 },
    { path: "/local", priority: 0.8 },
    { path: "/partners", priority: 0.7 },
    { path: "/sponsor", priority: 0.7 },
    { path: "/products", priority: 0.6 },
    { path: "/deals", priority: 0.6 },
    { path: "/join", priority: 0.8 },
    { path: "/policy", priority: 0.4 },
  ];

  return [
    ...staticPaths.map((s) => ({
      url: `${base}${s.path}`,
      changeFrequency: "daily" as const,
      priority: s.priority,
    })),
    ...categoryPaths.map((s) => ({
      url: `${base}${s.path}`,
      lastModified: s.lastModified,
      changeFrequency: s.changeFrequency,
      priority: s.priority,
    })),
    ...stories.map((s) => ({
      url: `${base}/articles/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...localStories.map((s) => ({
      url: `${base}/local/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
