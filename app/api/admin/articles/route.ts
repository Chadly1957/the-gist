import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { getWorkspace, workspaceUnique } from "@/lib/workspace";
import { scrapePastedUrl } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const articles = await prisma.article.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ articles });
}

export async function DELETE() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.article.deleteMany({});

  return NextResponse.json({ ok: true });
}

// Paste-a-link: fetch the URL, parse out title/description/image, and add it
// to the Article Pool (dedupe by URL, same as the scraper).
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "Paste a link first." }, { status: 400 });
  }

  const workspace = await getWorkspace();
  const scraped = await scrapePastedUrl(url);
  if (!scraped) {
    return NextResponse.json(
      { error: "Couldn't read that page. Check the link and try again." },
      { status: 422 }
    );
  }

  // Same local-tagging rule as the scheduled scraper.
  const tags =
    workspace.id === "decatur"
      ? scraped.tags
      : `${scraped.title} ${scraped.description}`.toLowerCase().includes(workspace.area.toLowerCase())
        ? [workspace.area.toLowerCase()]
        : [];

  const article = await prisma.article.upsert({
    where: await workspaceUnique("articleUrl", scraped.articleUrl),
    update: {
      title: scraped.title,
      description: scraped.description,
      imageUrl: scraped.imageUrl,
      sourceName: scraped.sourceName,
      publishedAt: scraped.publishedAt,
      tags,
    },
    create: {
      title: scraped.title,
      description: scraped.description,
      imageUrl: scraped.imageUrl,
      articleUrl: scraped.articleUrl,
      sourceName: scraped.sourceName,
      publishedAt: scraped.publishedAt,
      selected: false,
      tags,
    },
  });

  return NextResponse.json({ article });
}
