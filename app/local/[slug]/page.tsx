import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getWorkspace, getWorkspaceUrl } from "@/lib/workspace";
import { deriveExcerpt } from "@/lib/articles";
import {
  PARTNER_CATEGORIES,
  partnerCategoryLabel,
} from "@/lib/partner-categories";
import { getPartnerDirectory, type PartnerListing } from "@/lib/partners-directory";
import {
  LOCAL_CATEGORY_INDEX_MIN,
  isLocalCategorySlug,
  workspaceCityState,
} from "@/lib/local-seo";
import Link from "@/components/workspace/WorkspaceLink";
import SiteHeader from "@/components/SiteHeader";
import AboutGist from "@/components/AboutGist";
import ArticleViewBeacon from "@/components/articles/ArticleViewBeacon";

export const dynamic = "force-dynamic";

// One dynamic segment serves the whole /local section. Resolution order:
//   1. A valid partner category slug (except the house "from-the-gist")
//      renders the directory category page. Category slugs are reserved:
//      a story slug that collides with one resolves as the category.
//   2. A published story with section "local" renders as an evergreen page.
//   3. A published story with section "news" permanently redirects to its
//      canonical home at /articles/<slug>.
//   4. Anything else is a 404.
async function getLocalStory(slug: string) {
  return prisma.story.findFirst({
    where: { slug, status: "published", section: "local" },
  });
}

async function getNewsStory(slug: string) {
  return prisma.story.findFirst({
    where: { slug, status: "published", section: "news" },
    select: { id: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await getWorkspace();
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");

  if (isLocalCategorySlug(slug)) {
    const { byCategory } = await getPartnerDirectory();
    const items = byCategory.get(slug) ?? [];
    if (items.length === 0) return { title: "Page not found" };
    const label = partnerCategoryLabel(slug);
    const cityState = workspaceCityState(workspace.area);
    const title = `${label} in ${cityState}`;
    const description = `${items.length} local ${label} businesses in ${cityState}, listed by ${workspace.name}. Plus how to get your business listed free.`;
    return {
      title: `${title} | ${workspace.name}`,
      description,
      alternates: { canonical: `${base}/local/${slug}` },
      // Thin-page guard: below the listing threshold the page renders for
      // readers following internal links but stays out of the index.
      ...(items.length >= LOCAL_CATEGORY_INDEX_MIN
        ? {}
        : { robots: { index: false, follow: true } }),
      openGraph: { title, description, url: `${base}/local/${slug}`, type: "website" },
      twitter: { card: "summary", title, description },
    };
  }

  const story = await getLocalStory(slug).catch(() => null);
  if (!story) return { title: "Page not found" };
  const url = `${base}/local/${story.slug}`;
  const title = story.seoTitle?.trim() || story.headline;
  const description =
    story.seoDescription?.trim() || story.excerpt || deriveExcerpt(story.body);
  return {
    title: `${title} | ${workspace.name}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: story.publishedAt?.toISOString(),
      modifiedTime: story.updatedAt.toISOString(),
      authors: [story.author],
      images: story.headerImageUrl ? [story.headerImageUrl] : [],
    },
    twitter: {
      card: story.headerImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: story.headerImageUrl ? [story.headerImageUrl] : [],
    },
  };
}

export default async function LocalSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (isLocalCategorySlug(slug)) {
    return <CategoryPage slug={slug} />;
  }

  const story = await getLocalStory(slug);
  if (story) return <EvergreenStoryPage story={story} />;

  const news = await getNewsStory(slug);
  if (news) {
    const base = (await getWorkspaceUrl()).replace(/\/$/, "");
    permanentRedirect(`${base}/articles/${slug}`);
  }

  notFound();
}

// ---------------------------------------------------------------------------
// Category page: every public Community Partner listing in one directory
// category, presented as a local list built to be found by search.
// ---------------------------------------------------------------------------
async function CategoryPage({ slug }: { slug: string }) {
  const workspace = await getWorkspace();
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const { byCategory } = await getPartnerDirectory();
  const items = byCategory.get(slug) ?? [];
  if (items.length === 0) notFound();

  const label = partnerCategoryLabel(slug);
  const cityState = workspaceCityState(workspace.area);
  const pageUrl = `${base}/local/${slug}`;

  // Sibling strip links only the categories that are themselves
  // indexable, so the SEO pages pass authority among real pages.
  const siblings = PARTNER_CATEGORIES.filter((c) => {
    if (c.slug === slug || !isLocalCategorySlug(c.slug)) return false;
    return (byCategory.get(c.slug)?.length ?? 0) >= LOCAL_CATEGORY_INDEX_MIN;
  });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${label} in ${cityState}`,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "LocalBusiness",
        name: p.businessName,
        ...(p.ctaUrl ? { url: p.ctaUrl } : {}),
        ...(p.logoUrl ? { image: p.logoUrl } : {}),
        description: p.description,
      },
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Local", item: `${base}/local` },
      { "@type": "ListItem", position: 3, name: `${label} in ${cityState}`, item: pageUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8">
          <Link href="/local" className="text-sm text-gray-500 hover:text-gray-800">
            ← Local guide
          </Link>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-3">
            {label} in {cityState}
          </h1>
          <p className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Every business on this page is a Community Partner of {workspace.name},
            keeping a free listing with the newsletter your neighbors read each
            morning. Browse all {items.length} {label}{" "}
            {items.length === 1 ? "listing" : "listings"} in {cityState}, and tell
            them The Gist sent you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <PartnerCard key={p.id} p={p} />
          ))}
        </div>

        <div className="mt-12 max-w-2xl mx-auto text-center border border-green-100 bg-green-50 rounded-2xl px-6 py-8">
          <p className="font-bold text-gray-900 mb-1">
            Run a {label} business in {workspace.area}?
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Get listed here free. Community Partner listings are always free,
            and yours would show up on this page, in the full directory, and in
            the morning newsletter rotation.
          </p>
          <Link
            href="/sponsor"
            className="inline-block px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
          >
            Get listed here free
          </Link>
        </div>

        {siblings.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 text-center">
              More local categories
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {siblings.map((c) => (
                <Link
                  key={c.slug}
                  href={`/local/${c.slug}`}
                  className="px-3.5 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 hover:border-green-600 hover:bg-green-50 hover:text-green-800 transition-colors"
                >
                  {c.label} · {byCategory.get(c.slug)?.length}
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-10">
          See the full directory on{" "}
          <Link href="/partners" className="font-semibold text-green-700 hover:underline">
            Our Community Partners
          </Link>{" "}
          or head back to the{" "}
          <Link href="/local" className="font-semibold text-green-700 hover:underline">
            {workspace.area} local guide
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

// Card markup mirrors /partners exactly so the two pages never disagree
// about how a business is presented.
function PartnerCard({ p }: { p: PartnerListing }) {
  return (
    <div className="border border-gray-200 rounded-2xl p-5 flex flex-col">
      <div className="flex items-center gap-4 mb-3">
        {p.logoUrl ? (
          <Image
            src={p.logoUrl}
            alt={p.businessName}
            width={60}
            height={60}
            className="w-14 h-14 object-contain rounded shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-14 h-14 rounded bg-green-100 flex items-center justify-center shrink-0">
            <span className="text-green-700 font-bold text-xl">
              {p.businessName.charAt(0)}
            </span>
          </div>
        )}
        <p className="font-bold text-gray-900 leading-snug">{p.businessName}</p>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed flex-1">{p.description}</p>
      {p.ctaUrl && (
        <a
          href={p.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 self-start px-4 py-2 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
        >
          {p.ctaLabel || "Visit Website"}
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Evergreen story page: the article renderer with evergreen semantics
// (Article schema rather than NewsArticle, and a visible last-updated
// line instead of a news dateline).
// ---------------------------------------------------------------------------
async function EvergreenStoryPage({
  story,
}: {
  story: Awaited<ReturnType<typeof getLocalStory>>;
}) {
  if (!story) notFound();
  const workspace = await getWorkspace();
  const base = (await getWorkspaceUrl()).replace(/\/$/, "");
  const url = `${base}/local/${story.slug}`;
  const tz = workspace.timezone || "America/Chicago";

  const description =
    story.seoDescription?.trim() || story.excerpt || deriveExcerpt(story.body);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.headline,
    description,
    ...(story.headerImageUrl ? { image: [story.headerImageUrl] } : {}),
    datePublished: (story.publishedAt ?? story.createdAt).toISOString(),
    dateModified: story.updatedAt.toISOString(),
    author: { "@type": "Person", name: story.author },
    publisher: {
      "@type": "Organization",
      name: workspace.name,
      ...(workspace.logoUrl
        ? {
            logo: {
              "@type": "ImageObject",
              url: workspace.logoUrl.startsWith("http")
                ? workspace.logoUrl
                : `${base}${workspace.logoUrl}`,
            },
          }
        : {}),
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ArticleViewBeacon slug={story.slug} />
      <SiteHeader />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-end mb-8">
            <Link href="/local" className="text-sm text-gray-500 hover:text-gray-800">
              ← Local guide
            </Link>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">{story.headline}</h1>
          <p className="text-gray-500 mt-4">
            by <span className="font-medium text-gray-700">{story.author}</span>
            {" · "}
            Last updated{" "}
            <time dateTime={story.updatedAt.toISOString()}>
              {story.updatedAt.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: tz,
              })}
            </time>
          </p>

          {story.headerImageUrl && (
            <img src={story.headerImageUrl} alt={story.headline} className="w-full rounded-2xl border object-cover mt-8" />
          )}

          {/* Body HTML is sanitized against an allowlist when saved in the
              admin API (lib/articles.ts), so it is safe to render raw. */}
          <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: story.body }} />
        </article>
        <AboutGist utmCampaign={story.slug} />
      </main>
    </div>
  );
}
