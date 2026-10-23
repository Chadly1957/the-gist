import { prisma } from "@/lib/db";
import { getWorkspace } from "@/lib/workspace";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

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

  return (
    <div className="min-h-screen bg-white flex flex-col">
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
                      <img src={s.headerImageUrl} alt="" className="w-full sm:w-64 h-48 sm:h-auto object-cover shrink-0" />
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
