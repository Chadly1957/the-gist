import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

// The index used to inherit the generic site title/description from the
// root layout. It gets its own search-facing metadata (and canonical) so
// the page can rank as this city's article hub.
export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getWorkspace();
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const url = `${base}/articles`;
  const title = `${workspace.area} News & Community Stories | ${workspace.name}`;
  const description = `Original stories, explainers, and community news from ${workspace.name}, written for ${workspace.area} readers.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

// Public index of original articles for this workspace: a full browsing
// page for readers (and the page the newsletter's source scraper reads
// article links + Open Graph data from). Published only, newest first.
export default async function ArticlesIndexPage() {
  const workspace = await getWorkspace();
  const stories = await prisma.story.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
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
  const tz = workspace.timezone || "America/Chicago";
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");

  // ItemList structured data for the hub page: every published article,
  // newest first, generated from the same rows the page renders.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${workspace.name} Articles`,
    itemListElement: stories.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${base}/articles/${s.slug}`,
      name: s.headline,
    })),
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <SiteHeader />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <h1 className="text-3xl font-bold text-center text-gray-900">{workspace.name} Articles</h1>
          <p className="text-center text-gray-500 mt-2">
            Original stories and explainers from {workspace.name}, written for {workspace.area} readers.
          </p>

          {stories.length === 0 ? (
            <p className="text-center text-gray-400 mt-12">No articles published yet. Check back soon.</p>
          ) : (
            <div className="mt-10 space-y-6">
              {stories.map((s) => (
                <article key={s.id} className="border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                  <Link href={`/articles/${s.slug}`} className="flex flex-col sm:flex-row">
                    {s.headerImageUrl ? (
                      <img src={s.headerImageUrl} alt={s.headline} className="w-full sm:w-64 h-48 sm:h-auto object-cover shrink-0" />
                    ) : (
                      <div className="w-full sm:w-64 h-48 sm:h-auto bg-gray-100 shrink-0" />
                    )}
                    <div className="p-5">
                      <h2 className="text-xl font-bold text-gray-900">{s.headline}</h2>
                      <p className="text-sm text-gray-400 mt-1">
                        by {s.author}
                        {s.publishedAt && (
                          <>
                            {" · "}
                            <time dateTime={s.publishedAt.toISOString()}>
                              {s.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: tz })}
                            </time>
                          </>
                        )}
                      </p>
                      {s.excerpt && <p className="text-gray-600 leading-relaxed mt-3">{s.excerpt}</p>}
                      <span className="inline-block mt-4 text-sm font-semibold text-green-700">Read the article →</span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
