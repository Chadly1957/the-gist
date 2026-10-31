import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import Link from "@/components/workspace/WorkspaceLink";
import { getWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public Community Partners directory for this workspace: every business
// or organization with a live (approved/active) Community Partner listing
// gets a card here, alphabetical, one card per business. Contact details
// from the sponsor account are never selected or shown; a card carries
// only what the listing itself carries (name, logo, description, link).
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
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // One card per business: rows arrive newest first, so the first row seen
  // for a normalized business name is the one that renders.
  const seen = new Set<string>();
  const partners = rows.filter((r) => {
    const key = r.businessName.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  partners.sort((a, b) => a.businessName.localeCompare(b.businessName));

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Our Community Partners
          </h1>
          <p className="text-gray-500">
            The local businesses and organizations that stand behind {ws.name}.
          </p>
          <p className="text-gray-600 text-sm leading-relaxed mt-3 max-w-lg mx-auto">
            Every partner below keeps a free listing with us and helps keep the
            newsletter free for everyone in {ws.area}. Give them a look, and
            tell them The Gist sent you.
          </p>
        </div>

        {partners.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl max-w-2xl mx-auto">
            <p className="text-gray-500 text-sm mb-1">Our first Community Partners are on their way.</p>
            <p className="text-gray-400 text-sm">Check back soon, or be the first one listed below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((p) => (
              <div key={p.id} className="border border-gray-200 rounded-2xl p-5 flex flex-col">
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
            ))}
          </div>
        )}

        <div className="mt-12 max-w-2xl mx-auto text-center border border-green-100 bg-green-50 rounded-2xl px-6 py-8">
          <p className="font-bold text-gray-900 mb-1">Your business belongs here</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Community Partner listings are free. Add yours and it shows up on
            this page, in the morning newsletter rotation, and in front of
            your neighbors every day.
          </p>
          <Link
            href="/sponsor/community"
            className="inline-block px-5 py-2.5 bg-green-700 text-white rounded-lg font-semibold text-sm hover:bg-green-800"
          >
            Get your free listing
          </Link>
        </div>
      </div>
    </div>
  );
}
