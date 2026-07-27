import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

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

  // Match click URLs to sources by hostname — avoids depending on the Article
  // table, which can be cleared while LinkClick records persist.
  const sourceByHost = new Map<string, string>(); // hostname → source.id
  for (const s of sources) {
    const host = hostname(s.url);
    if (host) sourceByHost.set(host, s.id);
  }

  const clicksBySourceId = new Map<string, number>();
  for (const c of articleClicks) {
    const sourceId = sourceByHost.get(hostname(c.url));
    if (sourceId) clicksBySourceId.set(sourceId, (clicksBySourceId.get(sourceId) ?? 0) + 1);
  }

  const sourcesWithClicks = sources.map((s) => ({
    ...s,
    clickCount: clicksBySourceId.get(s.id) ?? 0,
  }));

  return NextResponse.json({ sources: sourcesWithClicks });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, url, keywords } = await req.json();
  if (!name || !url) {
    return NextResponse.json({ error: "Name and URL required." }, { status: 400 });
  }

  try {
    new URL(url); // validate URL
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  try {
    const source = await prisma.source.create({
      data: { name, url, keywords: keywords?.trim() ?? "" },
    });
    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Source with this URL already exists." },
      { status: 409 }
    );
  }
}
