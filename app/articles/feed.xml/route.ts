import { prisma } from "@/lib/db";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { cdata, deriveExcerpt, escapeXml } from "@/lib/articles";

export const dynamic = "force-dynamic";

// RSS 2.0 feed of this workspace's published original articles. This is
// the integration point for the newsletter's built-in sourcer: add
// https://thegist<city>.com/articles/feed.xml as a Source and each item
// lands in the article pool with headline, link, excerpt, header image,
// author, and publish date, exactly like an external outlet's story.
// (The pool's scraper only picks up items from the last 48 hours, same as
// every other source.)
export async function GET() {
  const workspace = await getWorkspace();
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const stories = await prisma.story.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const items = stories
    .map((s) => {
      const link = `${base}/articles/${s.slug}`;
      const pubDate = (s.publishedAt ?? s.updatedAt).toUTCString();
      const description = s.excerpt || deriveExcerpt(s.body);
      const image = s.headerImageUrl
        ? `\n      <media:content url="${escapeXml(s.headerImageUrl)}" medium="image" />\n      <enclosure url="${escapeXml(s.headerImageUrl)}" type="image/jpeg" />`
        : "";
      return `    <item>
      <title>${escapeXml(s.headline)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(s.author)}</dc:creator>
      <description>${escapeXml(description)}</description>
      <content:encoded>${cdata(s.body)}</content:encoded>${image}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(workspace.name)}</title>
    <link>${escapeXml(`${base}/articles`)}</link>
    <description>Original articles from ${escapeXml(workspace.name)}, the daily local briefing for ${escapeXml(workspace.area)}.</description>
    <language>en-us</language>
    <atom:link href="${escapeXml(`${base}/articles/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
