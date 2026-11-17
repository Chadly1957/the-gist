import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import {
  PARTNER_CATEGORIES,
  isPartnerCategory,
} from "@/lib/partner-categories";
import { isLocalCategorySlug } from "@/lib/local-seo";
import { PREMIUM_SHOWING_STATUSES } from "@/lib/premium-directory";

export const dynamic = "force-dynamic";

// Public Community Partners directory for this workspace: every business
// or organization with a live (approved/active) Community Partner listing
// gets a card here, grouped by the category on its listing, alphabetical
// inside each group, one card per business. Contact details from the
// sponsor account are never selected or shown; a card carries only what
// the business's profile carries (name, logo, description, link) — the
// listing is the placement row, the profile is the source of truth
// (unified 2026-11-12), and the listing columns are legacy snapshots.
// One directory card. Premium cards are the exact same markup with a
// gold border and a PREMIUM PARTNER eyebrow above the business name.
function PartnerCard({ p, premium = false }: { p: {
  id: string;
  businessName: string;
  logoUrl: string | null;
  description: string | null;
  ctaUrl: string | null;
  ctaLabel: string | null;
}; premium?: boolean }) {
  return (
    <div className={`border rounded-2xl p-5 flex flex-col ${premium ? "border-[#f59e0b]" : "border-gray-200"}`}>
      {premium && (
        <p className="text-[11px] font-bold tracking-[0.14em] text-amber-600 mb-2">PREMIUM PARTNER</p>
      )}
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

export default async function PartnersPage() {
  const ws = await getWorkspace();

  const rows = await prisma.spotlightListing.findMany({
    where: { status: { in: ["approved", "active"] } },
    select: {
      id: true,
      businessName: true,
      logoUrl: true,
      description: true,
      ctaLabel: true,
      ctaUrl: true,
      category: true,
      createdAt: true,
      sponsor: {
        select: { businessName: true, logoUrl: true, description: true, website: true, category: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Premium Directory placements: live subscriptions (active + past_due)
  // pin their listings at the top of the page, in first-come order.
  const premiumRows = await prisma.premiumDirectorySubscription.findMany({
    where: { status: { in: [...PREMIUM_SHOWING_STATUSES] } },
    orderBy: { startedAt: "asc" }, // first-come order, no rotation
    select: { spotlightId: true, startedAt: true },
  });
  const premiumStartedAt = new Map(premiumRows.map((r) => [r.spotlightId, r.startedAt]));

  // Read the business fields off the profile, falling back to the
  // listing snapshot where the profile field is still empty.
  const mapped = rows.map(({ sponsor, ...r }) => ({
    ...r,
    businessName: sponsor.businessName,
    logoUrl: sponsor.logoUrl ?? r.logoUrl,
    description: sponsor.description ?? r.description,
    ctaUrl: sponsor.website ?? r.ctaUrl,
    category: sponsor.category ?? r.category,
  }));

  // One card per business: rows arrive newest first, so the first row seen
  // for a normalized business name is the one that renders.
  const seen = new Set<string>();
  const partners = mapped.filter((r) => {
    const key = r.businessName.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  partners.sort((a, b) => a.businessName.localeCompare(b.businessName));

  // Premium partners render first, in startedAt (first-come) order, and
  // are excluded from their category sections below: one card per business.
  const premiumPartners = partners
    .filter((p) => premiumStartedAt.has(p.id))
    .sort((a, b) => {
      const aAt = premiumStartedAt.get(a.id)?.getTime() ?? 0;
      const bAt = premiumStartedAt.get(b.id)?.getTime() ?? 0;
      return aAt - bAt;
    });
  const premiumIds = new Set(premiumPartners.map((p) => p.id));
  const regularPartners = partners.filter((p) => !premiumIds.has(p.id));

  // Group into directory sections in the fixed category order. Anything
  // uncategorized (or carrying an unrecognized slug) lands in the trailing
  // section so no live listing is ever hidden.
  const sections: { slug: string; label: string; items: typeof partners }[] = [];
  for (const cat of PARTNER_CATEGORIES) {
    const items = regularPartners.filter((p) => p.category === cat.slug);
    if (items.length > 0) sections.push({ slug: cat.slug, label: cat.label, items });
  }
  const uncategorized = regularPartners.filter((p) => !isPartnerCategory(p.category));
  if (uncategorized.length > 0) {
    sections.push({ slug: "more", label: "More Community Partners", items: uncategorized });
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Our Community Partners
          </h1>
          <p className="text-gray-500">
            The local businesses and organizations that stand behind {ws.name}.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mt-3 max-w-lg mx-auto">
            Every partner below keeps a free listing with us and helps keep the
            newsletter free for everyone in {ws.area}. Browse the directory,
            give them a look, and tell them The Gist sent you.
          </p>
        </div>

        {partners.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl max-w-2xl mx-auto">
            <p className="text-gray-500 text-sm mb-1">Our first Community Partners are on their way.</p>
            <p className="text-gray-400 text-sm">Check back soon, or be the first one listed below.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {premiumPartners.length > 0 && (
                <a
                  href="#premium"
                  className="px-3.5 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 hover:border-green-600 hover:bg-green-50 hover:text-green-800 transition-colors"
                >
                  Premium Partners · {premiumPartners.length}
                </a>
              )}
              {sections.map((s) => (
                <a
                  key={s.slug}
                  href={`#${s.slug}`}
                  className="px-3.5 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 hover:border-green-600 hover:bg-green-50 hover:text-green-800 transition-colors"
                >
                  {s.label} · {s.items.length}
                </a>
              ))}
            </div>

            {premiumPartners.length > 0 && (
              <section id="premium" className="mb-12 scroll-mt-24">
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                    Premium Partners
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {premiumPartners.map((p) => (
                    <PartnerCard key={p.id} p={p} premium />
                  ))}
                </div>
              </section>
            )}

            {sections.map((s) => (
              <section key={s.slug} id={s.slug} className="mb-12 scroll-mt-24">
                <div className="flex items-baseline justify-between gap-4 mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
                    {s.label}
                  </h2>
                  {isLocalCategorySlug(s.slug) && (
                    <Link
                      href={`/local/${s.slug}`}
                      className="text-xs font-semibold text-green-700 hover:underline shrink-0"
                    >
                      See all {s.label} in {ws.area} →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {s.items.map((p) => (
                    <PartnerCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        <div className="mt-4 max-w-2xl mx-auto text-center border border-green-100 bg-green-50 rounded-2xl px-6 py-8">
          <p className="font-bold text-gray-900 mb-1">Your business belongs here</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Community Partner listings are free. Add yours and it shows up on
            this page, in the morning newsletter rotation, and in front of
            your neighbors every day.
          </p>
          <Link
            href="/sponsor#free-signup"
            className="inline-block px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
          >
            Get your free listing
          </Link>
        </div>
      </div>
    </div>
  );
}
