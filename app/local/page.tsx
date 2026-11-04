import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { PARTNER_CATEGORIES } from "@/lib/partner-categories";
import { getPartnerDirectory } from "@/lib/partners-directory";
import {
  LOCAL_CATEGORY_INDEX_MIN,
  isLocalCategorySlug,
  workspaceCityState,
} from "@/lib/local-seo";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

// Hub for the /local section: the directory category pages that have
// earned indexing (enough live listings to be real content) and this
// workspace's evergreen local stories, freshest update first. Indexable
// from launch on the strength of the category pages.
export async function generateMetadata(): Promise<Metadata> {
  const workspace = await getWorkspace();
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const url = `${base}/local`;
  const cityState = workspaceCityState(workspace.area);
  const title = `${workspace.area} Local Guide`;
  const description = `Local businesses by category and evergreen guides for ${cityState}, from ${workspace.name}.`;
  return {
    title: `${title} | ${workspace.name}`,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function LocalHubPage() {
  const workspace = await getWorkspace();
  const cityState = workspaceCityState(workspace.area);
  const tz = workspace.timezone || "America/Chicago";

  const { byCategory } = await getPartnerDirectory();
  const categories = PARTNER_CATEGORIES.filter(
    (c) =>
      isLocalCategorySlug(c.slug) &&
      (byCategory.get(c.slug)?.length ?? 0) >= LOCAL_CATEGORY_INDEX_MIN
  ).map((c) => ({ slug: c.slug, label: c.label, count: byCategory.get(c.slug)?.length ?? 0 }));

  const stories = await prisma.story.findMany({
    where: { status: "published", section: "local" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      headline: true,
      slug: true,
      headerImageUrl: true,
      excerpt: true,
      updatedAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            {workspace.area} Local Guide
          </h1>
          <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Local businesses worth knowing in {cityState}, organized by what
            they do, plus evergreen guides from {workspace.name} that stay
            useful long after the morning newsletter moves on.
          </p>
        </div>

        {categories.length > 0 && (
          <section className="mb-14">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
              Browse local businesses
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/local/${c.slug}`}
                  className="border border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-shadow block"
                >
                  <p className="font-bold text-gray-900">
                    {c.label} in {cityState}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {c.count} local {c.count === 1 ? "business" : "businesses"} listed
                  </p>
                  <span className="inline-block mt-3 text-sm font-semibold text-green-700">
                    Browse the list →
                  </span>
                </Link>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Looking for the full directory? Every Community Partner, all in
              one place:{" "}
              <Link href="/partners" className="font-semibold text-green-700 hover:underline">
                Our Community Partners
              </Link>
              .
            </p>
          </section>
        )}

        {stories.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
              Guides &amp; explainers
            </h2>
            <div className="space-y-6">
              {stories.map((s) => (
                <article key={s.id} className="border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                  <Link href={`/local/${s.slug}`} className="flex flex-col sm:flex-row">
                    {s.headerImageUrl ? (
                      <img src={s.headerImageUrl} alt={s.headline} className="w-full sm:w-64 h-48 sm:h-auto object-cover shrink-0" />
                    ) : (
                      <div className="w-full sm:w-64 h-48 sm:h-auto bg-gray-100 shrink-0" />
                    )}
                    <div className="p-5">
                      <h3 className="text-xl font-bold text-gray-900">{s.headline}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Last updated{" "}
                        <time dateTime={s.updatedAt.toISOString()}>
                          {s.updatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: tz })}
                        </time>
                      </p>
                      {s.excerpt && <p className="text-gray-600 leading-relaxed mt-3">{s.excerpt}</p>}
                      <span className="inline-block mt-4 text-sm font-semibold text-green-700">Read the guide →</span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {categories.length === 0 && stories.length === 0 && (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl max-w-2xl mx-auto">
            <p className="text-gray-500 text-sm mb-1">The {workspace.area} local guide is on its way.</p>
            <p className="text-gray-400 text-sm">
              In the meantime, browse{" "}
              <Link href="/partners" className="font-semibold text-green-700 hover:underline">
                Our Community Partners
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
