import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import { deriveExcerpt } from "@/lib/articles";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";
import AboutGist from "@/components/AboutGist";

export const dynamic = "force-dynamic";

async function getPublishedStory(slug: string) {
  return prisma.story.findFirst({
    where: { slug, status: "published" },
  });
}

// Open Graph + article:published_time metadata: this is what social shares
// show, and what the newsletter's source scraper reads when /articles is
// added as a source (it requires a title, description, and a real date).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getPublishedStory(slug).catch(() => null);
  if (!story) return { title: "Article not found" };
  const workspace = await getWorkspace();
  const description = story.excerpt || deriveExcerpt(story.body);
  return {
    title: `${story.headline} | ${workspace.name}`,
    description,
    openGraph: {
      title: story.headline,
      description,
      type: "article",
      publishedTime: story.publishedAt?.toISOString(),
      authors: [story.author],
      images: story.headerImageUrl ? [story.headerImageUrl] : [],
    },
    twitter: {
      card: story.headerImageUrl ? "summary_large_image" : "summary",
      title: story.headline,
      description,
      images: story.headerImageUrl ? [story.headerImageUrl] : [],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getPublishedStory(slug);
  if (!story) notFound();
  const workspace = await getWorkspace();
  const tz = workspace.timezone || "America/Chicago";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-end mb-8">
            <Link href="/articles" className="text-sm text-gray-500 hover:text-gray-800">← All articles</Link>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">{story.headline}</h1>
          <p className="text-gray-500 mt-4">
            by <span className="font-medium text-gray-700">{story.author}</span>
            {story.publishedAt && (
              <>
                {" · "}
                <time dateTime={story.publishedAt.toISOString()}>
                  {story.publishedAt.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: tz,
                  })}
                </time>
              </>
            )}
          </p>

          {story.headerImageUrl && (
            <img src={story.headerImageUrl} alt="" className="w-full rounded-2xl border object-cover mt-8" />
          )}

          {/* Body HTML is sanitized against an allowlist when saved in the
              admin API (lib/articles.ts), so it is safe to render raw. */}
          <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: story.body }} />
        </article>
        <AboutGist />
      </main>
    </div>
  );
}
