import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// GET /api/articles?limit=3 — this workspace's latest published original
// articles (the CMS Stories behind /articles), public read for the homepage.
// Published news-section stories only, newest first. Only public fields are
// returned: no body, no view counts, no SEO overrides, no drafts.
export async function GET(req: Request) {
  const { id: workspaceId } = await getWorkspace();
  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "3");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 10) : 3;
  const stories = await prisma.story.findMany({
    where: { workspaceId, status: "published", section: "news", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      headline: true,
      slug: true,
      author: true,
      headerImageUrl: true,
      excerpt: true,
      publishedAt: true,
    },
  });
  return NextResponse.json(stories);
}
