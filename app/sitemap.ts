import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { getWorkspaceUrl } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// Per-host sitemap, served at /sitemap.xml on every domain. The workspace
// resolves from the request host (same helper as the RSS feed), so each
// city domain lists only its own public pages and published articles.
// Drafts are never included.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const stories = await prisma.story.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: { slug: true, updatedAt: true },
    take: 500,
  });

  const staticPaths: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/articles", priority: 0.9 },
    { path: "/partners", priority: 0.7 },
    { path: "/sponsor", priority: 0.7 },
    { path: "/products", priority: 0.6 },
    { path: "/deals", priority: 0.6 },
    { path: "/join", priority: 0.8 },
  ];

  return [
    ...staticPaths.map((s) => ({
      url: `${base}${s.path}`,
      changeFrequency: "daily" as const,
      priority: s.priority,
    })),
    ...stories.map((s) => ({
      url: `${base}/articles/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
