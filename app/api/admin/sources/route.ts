import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sources, articleClicks] = await Promise.all([
    prisma.source.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.linkClick.findMany({
      where: { linkType: "article" },
      select: { url: true },
    }),
  ]);

  // Count clicks per article URL
  const clicksByUrl = new Map<string, number>();
  for (const c of articleClicks) {
    clicksByUrl.set(c.url, (clicksByUrl.get(c.url) ?? 0) + 1);
  }

  // Map article URL → sourceName via Article table
  const clickedUrls = Array.from(clicksByUrl.keys());
  const articles = clickedUrls.length > 0
    ? await prisma.article.findMany({
        where: { articleUrl: { in: clickedUrls } },
        select: { articleUrl: true, sourceName: true },
      })
    : [];

  // Aggregate total clicks per sourceName
  const clicksBySource = new Map<string, number>();
  for (const a of articles) {
    const count = clicksByUrl.get(a.articleUrl) ?? 0;
    clicksBySource.set(a.sourceName, (clicksBySource.get(a.sourceName) ?? 0) + count);
  }

  const sourcesWithClicks = sources.map((s) => ({
    ...s,
    clickCount: clicksBySource.get(s.name) ?? 0,
  }));

  return NextResponse.json({ sources: sourcesWithClicks });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, url } = await req.json();
  if (!name || !url) {
    return NextResponse.json({ error: "Name and URL required." }, { status: 400 });
  }

  try {
    new URL(url); // validate URL
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  try {
    const source = await prisma.source.create({ data: { name, url } });
    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Source with this URL already exists." },
      { status: 409 }
    );
  }
}
