import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { scrapeAllSources } from "@/lib/scraper";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.source.findMany({
    where: { active: true },
    select: { url: true, name: true, keywords: true },
  });

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "No active sources configured. Add sources first." },
      { status: 400 }
    );
  }

  const scraped = await scrapeAllSources(sources);

  if (scraped.length === 0) {
    return NextResponse.json(
      { error: "No recent articles found. Sources may not have new content in the last 48 hours." },
      { status: 200 }
    );
  }

  // Upsert articles into DB
  const upserted = await Promise.allSettled(
    scraped.map((a) =>
      prisma.article.upsert({
        where: { articleUrl: a.articleUrl },
        update: {
          title: a.title,
          description: a.description,
          imageUrl: a.imageUrl,
          sourceName: a.sourceName,
          publishedAt: a.publishedAt,
          tags: a.tags,
        },
        create: {
          title: a.title,
          description: a.description,
          imageUrl: a.imageUrl,
          articleUrl: a.articleUrl,
          sourceName: a.sourceName,
          publishedAt: a.publishedAt,
          selected: false,
          tags: a.tags,
        },
      })
    )
  );

  const saved = upserted.filter((r) => r.status === "fulfilled").length;

  // Return all articles (sorted newest first)
  const articles = await prisma.article.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    message: `Scraped ${saved} articles from ${sources.length} sources.`,
    articles,
  });
}
