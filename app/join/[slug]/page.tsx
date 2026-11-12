import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import { getSponsorFeaturedCard, resolveSponsorBySlug } from "@/lib/sponsor-kit";
import { sponsorSlug } from "@/lib/sponsor-slug";
import SponsorJoinClient from "./SponsorJoinClient";

export const dynamic = "force-dynamic";

// Per-sponsor join landing page (Sponsor Amp Kit). Same page as /join,
// except the side visual is the inviting sponsor's Community Partner
// card instead of the latest-issue cards, and the signup attributes to
// that sponsor. Conversion page, not an SEO page: noindex, and never
// added to the sitemap. Unknown or ambiguous slugs 404.
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const workspace = await getWorkspace();
  const profile = await resolveSponsorBySlug(params.slug);
  if (!profile) {
    return { title: `Join ${workspace.name}`, robots: { index: false, follow: true } };
  }
  return {
    title: `Join ${workspace.name} — invited by ${profile.businessName}`,
    description: `${profile.businessName} invites you to join ${workspace.name}, the free daily newsletter for ${workspace.area} IL.`,
    robots: { index: false, follow: true },
  };
}

export default async function SponsorJoinPage({
  params,
}: {
  params: { slug: string };
}) {
  const profile = await resolveSponsorBySlug(params.slug);
  if (!profile) notFound();

  const card = await getSponsorFeaturedCard(profile);

  return (
    <SponsorJoinClient
      sponsorName={profile.businessName}
      sponsorSlug={sponsorSlug(profile)}
      card={card}
    />
  );
}
