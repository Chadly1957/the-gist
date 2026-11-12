import QRCode from "qrcode";
import { prisma } from "./db";
import { sponsorPlainSlug, sponsorSlug } from "./sponsor-slug";

// Server side of the Sponsor Amp Kit: resolving a landing slug back to a
// sponsor profile, building the featured listing card for the landing
// page, and rendering the QR PNG. Slug helpers live in
// lib/sponsor-slug.ts (pure, shared with the admin UI).

export interface SponsorProfileLite {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  website: string | null;
  logoUrl: string | null;
  description: string | null;
}

const PROFILE_SELECT = {
  id: true,
  businessName: true,
  contactName: true,
  email: true,
  website: true,
  logoUrl: true,
  description: true,
} as const;

// Resolve a /join/<slug> segment to a sponsor in this workspace.
// Canonical suffixed slug wins first; then the plain slugified business
// name when it matches exactly one profile. Ambiguous plain names and
// unknown slugs both return null (the page 404s).
export async function resolveSponsorBySlug(
  slug: string
): Promise<SponsorProfileLite | null> {
  const target = slug.trim().toLowerCase();
  if (!target) return null;

  const profiles = await prisma.sponsorProfile.findMany({ select: PROFILE_SELECT });
  const canonical = profiles.find((p) => sponsorSlug(p) === target);
  if (canonical) return canonical;

  const plain = profiles.filter((p) => sponsorPlainSlug(p) === target);
  if (plain.length === 1) return plain[0];
  return null;
}

export interface SponsorFeaturedCard {
  businessName: string;
  logoUrl: string | null;
  description: string;
  ctaLabel: string;
  ctaUrl: string | null;
}

// The card shown beside the signup form on /join/<slug>: the sponsor's
// public Community Partner listing when they have one (same public set
// as /partners). The business copy comes from the PROFILE (single source
// of truth, unified 2026-11-12); the listing only contributes its
// placement-only field (ctaLabel), with its legacy snapshot columns as
// a fallback where the profile field is still empty.
export async function getSponsorFeaturedCard(
  profile: SponsorProfileLite
): Promise<SponsorFeaturedCard> {
  const listing = await prisma.spotlightListing.findFirst({
    where: { sponsorId: profile.id, status: { in: ["approved", "active"] } },
    orderBy: { createdAt: "desc" },
    select: {
      logoUrl: true,
      description: true,
      ctaLabel: true,
      ctaUrl: true,
    },
  });
  if (listing) {
    return {
      businessName: profile.businessName,
      logoUrl: profile.logoUrl ?? listing.logoUrl,
      description: profile.description ?? listing.description,
      ctaLabel: listing.ctaLabel || "Visit Website",
      ctaUrl: profile.website ?? listing.ctaUrl ?? null,
    };
  }
  return {
    businessName: profile.businessName,
    logoUrl: profile.logoUrl,
    description:
      profile.description ??
      `A local business and proud Community Partner of this newsletter, right here in town.`,
    ctaLabel: "Visit Website",
    ctaUrl: profile.website,
  };
}

// The downloadable QR PNG: ~1024px, error-correction level M, with a
// quiet-zone margin so cheap flyer printing still scans.
export async function buildSponsorQrPng(targetUrl: string): Promise<Buffer> {
  return QRCode.toBuffer(targetUrl, {
    errorCorrectionLevel: "M",
    width: 1024,
    margin: 2,
  });
}
