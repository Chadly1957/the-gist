import sharp from "sharp";
import QRCode from "qrcode";
import type { MediaKitZone } from "./media-kit-shared";

// Pure composition core for the Media Kit Builder: no database, no
// request state. lib/media-kit.ts loads templates/profiles and calls
// into here; this module is also exercised directly by local tests.
//
// composeTemplateImage draws two overlays onto a template image:
//   1. the sponsor's QR code, rendered square inside the QR zone, and
//   2. the sponsor's logo, contain-fit inside the logo zone with its
//      transparency preserved. When the profile has no usable logo, the
//      business name is rendered as text in the logo zone instead
//      (approved fallback, Nov 5 2026) and the caller is told why.

export interface ComposeProfile {
  businessName: string;
  logoUrl: string | null;
}

export interface ComposeResult {
  png: Buffer;
  usedLogoFallback: boolean;
  logoFallbackReason: string | null;
}

// The join URL baked into a kit QR: same shape as the Amp Kit flyer QR
// (lib/sponsor-slug.ts sponsorQrTargetUrl) but with the medium swapped
// so flyer scans and social-image scans attribute separately.
export function mediaKitQrTargetUrl(appUrl: string, slug: string, medium: "flyer" | "social"): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/join/${slug}?utm_source=sponsor&utm_medium=${medium}&utm_campaign=${slug}`;
}

// QR PNG at an exact pixel size (the Amp Kit buildSponsorQrPng is the
// same recipe pinned to 1024px for the standalone download).
export async function buildQrPngAtSize(targetUrl: string, sizePx: number): Promise<Buffer> {
  return QRCode.toBuffer(targetUrl, {
    errorCorrectionLevel: "M",
    width: Math.max(64, Math.round(sizePx)),
    margin: 2,
    type: "png",
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Business name as an SVG overlay sized for the logo zone: bold sans,
// dark slate, single line, shrunk (and if needed squeezed via
// textLength) until it fits the box.
export function nameFallbackSvg(businessName: string, widthPx: number, heightPx: number): Buffer {
  const name = businessName.trim() || "Community Partner";
  let fontSize = Math.max(14, Math.floor(heightPx * 0.42));
  // Bold-sans glyph advance runs about 0.62em for DejaVu Sans Bold.
  // Estimate the line width, shrink the font if it would exceed 94% of
  // the zone, and pin the rendered width with textLength so font
  // metrics on the server can never push the name past the zone edges.
  const maxWidth = widthPx * 0.94;
  let estimatedWidth = 0.62 * fontSize * name.length;
  if (estimatedWidth > maxWidth) {
    fontSize = Math.max(12, Math.floor(fontSize * (maxWidth / estimatedWidth)));
    estimatedWidth = 0.62 * fontSize * name.length;
  }
  const textLengthAttr = ` textLength="${Math.round(Math.min(estimatedWidth, maxWidth))}" lengthAdjust="spacingAndGlyphs"`;
  const baselineY = Math.round(heightPx / 2 + fontSize * 0.36);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}"><text x="${Math.round(widthPx / 2)}" y="${baselineY}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#1f2937" text-anchor="middle"${textLengthAttr}>${escapeXml(name)}</text></svg>`;
  return Buffer.from(svg);
}

interface PlacedOverlay {
  input: Buffer;
  left: number;
  top: number;
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TheGistMediaKit/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

// Resolve the logo overlay for one zone: the fetched logo contain-fit
// and centered, or the name-as-text fallback with the reason recorded.
async function resolveLogoOverlay(
  profile: ComposeProfile,
  zoneLeft: number,
  zoneTop: number,
  zoneWidth: number,
  zoneHeight: number
): Promise<{ overlay: PlacedOverlay; usedFallback: boolean; reason: string | null }> {
  const fallback = (reason: string) => ({
    overlay: {
      input: nameFallbackSvg(profile.businessName, zoneWidth, zoneHeight),
      left: zoneLeft,
      top: zoneTop,
    },
    usedFallback: true,
    reason,
  });

  if (!profile.logoUrl) return fallback("No logo on file for this sponsor.");

  try {
    const raw = await fetchImageBuffer(profile.logoUrl);
    const resized = await sharp(raw)
      .resize({ width: zoneWidth, height: zoneHeight, fit: "inside" })
      .png()
      .toBuffer();
    const meta = await sharp(resized).metadata();
    const w = meta.width || zoneWidth;
    const h = meta.height || zoneHeight;
    return {
      overlay: {
        input: resized,
        left: zoneLeft + Math.round((zoneWidth - w) / 2),
        top: zoneTop + Math.round((zoneHeight - h) / 2),
      },
      usedFallback: false,
      reason: null,
    };
  } catch {
    return fallback("The sponsor's logo could not be loaded, so their business name was used instead.");
  }
}

export async function composeTemplateImage(
  template: Buffer,
  opts: {
    qrTargetUrl: string;
    profile: ComposeProfile;
    qrZone: MediaKitZone;
    logoZone: MediaKitZone;
  }
): Promise<ComposeResult> {
  const base = sharp(template);
  const meta = await base.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) throw new Error("Template image has no readable dimensions.");

  // QR zone: render the code square at the smaller dimension and center
  // it in the zone, so a slightly rectangular saved zone never distorts
  // the code.
  const qrZoneW = Math.round(opts.qrZone.w * width);
  const qrZoneH = Math.round(opts.qrZone.h * height);
  const qrSize = Math.max(32, Math.min(qrZoneW, qrZoneH));
  const qrPng = await buildQrPngAtSize(opts.qrTargetUrl, qrSize);
  const qrOverlay: PlacedOverlay = {
    input: qrPng,
    left: Math.round(opts.qrZone.x * width) + Math.round((qrZoneW - qrSize) / 2),
    top: Math.round(opts.qrZone.y * height) + Math.round((qrZoneH - qrSize) / 2),
  };

  const logoZoneW = Math.max(16, Math.round(opts.logoZone.w * width));
  const logoZoneH = Math.max(16, Math.round(opts.logoZone.h * height));
  const logo = await resolveLogoOverlay(
    opts.profile,
    Math.round(opts.logoZone.x * width),
    Math.round(opts.logoZone.y * height),
    logoZoneW,
    logoZoneH
  );

  const png = await sharp(template)
    .composite([qrOverlay, logo.overlay])
    .png()
    .toBuffer();

  return { png, usedLogoFallback: logo.usedFallback, logoFallbackReason: logo.reason };
}

// Minimal single-image PDF: one page at exactly 8.5x11in (612x792pt)
// with a JPEG embedded full-bleed. Hand-rolled because the repo has no
// PDF dependency and this structure is small and well understood; the
// JPEG bytes come from sharp.
export function wrapJpegInPdf(jpeg: Buffer, jpegWidth: number, jpegHeight: number): Buffer {
  const pageWidth = 612;
  const pageHeight = 792;
  const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (buf: Buffer) => {
    parts.push(buf);
    length += buf.length;
  };
  const pushText = (text: string) => push(Buffer.from(text, "ascii"));
  const beginObject = (num: number) => {
    offsets[num] = length;
    pushText(`${num} 0 obj\n`);
  };

  pushText("%PDF-1.4\n");
  beginObject(1);
  pushText("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  beginObject(2);
  pushText("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  beginObject(3);
  pushText(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );
  beginObject(4);
  pushText(
    `<< /Type /XObject /Subtype /Image /Width ${jpegWidth} /Height ${jpegHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  push(jpeg);
  pushText("\nendstream\nendobj\n");
  beginObject(5);
  pushText(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefStart = length;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pushText(xref);
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return Buffer.concat(parts);
}

export async function buildFlyerPdf(flyerPng: Buffer): Promise<Buffer> {
  const jpeg = await sharp(flyerPng).jpeg({ quality: 92 }).toBuffer();
  const meta = await sharp(jpeg).metadata();
  return wrapJpegInPdf(jpeg, meta.width || 0, meta.height || 0);
}

// Downscaled JPEG render for the admin preview (the send path always
// uses the full-resolution PNG/PDF).
export async function buildPreviewDataUrl(png: Buffer): Promise<string> {
  const preview = await sharp(png)
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${preview.toString("base64")}`;
}
