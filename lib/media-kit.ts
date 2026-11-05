import { prisma } from "./db";
import { getWorkspaceUrl } from "./workspace";
import { buildSponsorQrPng } from "./sponsor-kit";
import { sponsorQrTargetUrl, sponsorSlug } from "./sponsor-slug";
import {
  buildFlyerPdf,
  buildPreviewDataUrl,
  composeTemplateImage,
  mediaKitQrTargetUrl,
} from "./media-kit-compose";
import {
  DEFAULT_LOGO_ZONE,
  DEFAULT_QR_ZONE,
  isValidZone,
  type MediaKitKind,
  type MediaKitZone,
} from "./media-kit-shared";

// Server orchestration for the Media Kit Builder: template storage
// reads, and full kit generation for one sponsor profile. Composition
// itself lives in lib/media-kit-compose.ts (pure, testable).

export interface MediaKitTemplateData {
  kind: MediaKitKind;
  imageUrl: string;
  qrZone: MediaKitZone;
  logoZone: MediaKitZone;
  updatedAt: Date;
}

function zoneOrDefault(value: unknown, fallback: MediaKitZone): MediaKitZone {
  return isValidZone(value) ? (value as MediaKitZone) : fallback;
}

export async function getMediaKitTemplate(kind: MediaKitKind): Promise<MediaKitTemplateData | null> {
  const row = await prisma.mediaKitTemplate.findFirst({ where: { kind } });
  if (!row) return null;
  return {
    kind,
    imageUrl: row.imageUrl,
    qrZone: zoneOrDefault(row.qrZone, DEFAULT_QR_ZONE),
    logoZone: zoneOrDefault(row.logoZone, DEFAULT_LOGO_ZONE),
    updatedAt: row.updatedAt,
  };
}

export async function getMediaKitTemplates(): Promise<Record<MediaKitKind, MediaKitTemplateData | null>> {
  const [flyer, social] = await Promise.all([getMediaKitTemplate("flyer"), getMediaKitTemplate("social")]);
  return { flyer, social };
}

async function fetchTemplateBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; TheGistMediaKit/1.0)" },
  });
  if (!res.ok) throw new Error(`Template image could not be loaded (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

export interface MediaKitProfile {
  id: string;
  businessName: string;
  logoUrl: string | null;
}

export interface BuiltMediaKit {
  flyerPng: Buffer;
  flyerPdf: Buffer;
  socialPng: Buffer;
  qrPng: Buffer;
  usedLogoFallback: boolean;
  logoFallbackReason: string | null;
}

export class MediaKitMissingTemplatesError extends Error {
  missing: MediaKitKind[];
  constructor(missing: MediaKitKind[]) {
    super(`Media kit templates are not set up yet (missing: ${missing.join(", ")}).`);
    this.missing = missing;
  }
}

// Compose the full kit for one sponsor: flyer PNG + print PDF, social
// PNG, and the standalone QR PNG (flyer URL, same as the Amp Kit
// download). Throws MediaKitMissingTemplatesError when either template
// is absent so routes can show the setup state instead of failing.
export async function buildMediaKit(profile: MediaKitProfile): Promise<BuiltMediaKit> {
  const templates = await getMediaKitTemplates();
  const missing = (["flyer", "social"] as MediaKitKind[]).filter((k) => !templates[k]);
  if (missing.length > 0) throw new MediaKitMissingTemplatesError(missing);

  const appUrl = await getWorkspaceUrl();
  const slug = sponsorSlug(profile);
  const composeProfile = { businessName: profile.businessName, logoUrl: profile.logoUrl };

  const flyerTemplate = await fetchTemplateBuffer(templates.flyer!.imageUrl);
  const flyer = await composeTemplateImage(flyerTemplate, {
    qrTargetUrl: mediaKitQrTargetUrl(appUrl, slug, "flyer"),
    profile: composeProfile,
    qrZone: templates.flyer!.qrZone,
    logoZone: templates.flyer!.logoZone,
  });

  const socialTemplate = await fetchTemplateBuffer(templates.social!.imageUrl);
  const social = await composeTemplateImage(socialTemplate, {
    qrTargetUrl: mediaKitQrTargetUrl(appUrl, slug, "social"),
    profile: composeProfile,
    qrZone: templates.social!.qrZone,
    logoZone: templates.social!.logoZone,
  });

  const [flyerPdf, qrPng] = await Promise.all([
    buildFlyerPdf(flyer.png),
    buildSponsorQrPng(sponsorQrTargetUrl(appUrl, slug)),
  ]);

  return {
    flyerPng: flyer.png,
    flyerPdf,
    socialPng: social.png,
    qrPng,
    usedLogoFallback: flyer.usedLogoFallback || social.usedLogoFallback,
    logoFallbackReason: flyer.logoFallbackReason || social.logoFallbackReason,
  };
}

// Preview payload for the admin panel: downscaled JPEG data URLs of the
// two composed images, plus the fallback note. Full-resolution files
// are only generated on the send path.
export async function buildMediaKitPreview(profile: MediaKitProfile) {
  const kit = await buildMediaKit(profile);
  const [flyerPreview, socialPreview] = await Promise.all([
    buildPreviewDataUrl(kit.flyerPng),
    buildPreviewDataUrl(kit.socialPng),
  ]);
  return {
    flyerPreview,
    socialPreview,
    usedLogoFallback: kit.usedLogoFallback,
    logoFallbackReason: kit.logoFallbackReason,
  };
}
