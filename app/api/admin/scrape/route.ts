import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { scrapeAllSources } from "@/lib/scraper";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sources = await prisma.source.findMany({
    where: { active: true },
    select: { url: true, name: true, keywords: true },
  });

  if (sources.length === 0) {
    return new Response(
      JSON.stringify({ error: "No active sources configured. Add sources first." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        send({ type: "start", total: sources.length });

        const scraped = await scrapeAllSources(sources, (result) => {
          send(
            result.error
              ? { type: "source_error", name: result.name, error: result.error }
              : { type: "source_done", name: result.name, count: result.count }
          );
        });

        if (scraped.length === 0) {
          send({ type: "done", articles: [], message: "No recent articles found across all sources." });
          controller.close();
          return;
        }

        // Upsert to DB
        await Promise.allSettled(
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

        const articles = await prisma.article.findMany({
          orderBy: { publishedAt: "desc" },
          take: 50,
        });

        send({
          type: "done",
          articles,
          message: `Found ${scraped.length} articles from ${sources.length} sources.`,
        });
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
