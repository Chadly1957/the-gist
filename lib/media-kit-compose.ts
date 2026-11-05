import sharp from "sharp";
import QRCode from "qrcode";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parse as parseFont, type Font } from "opentype.js";
import type { MediaKitZone } from "./media-kit-shared";
import { MEDIA_KIT_FONT_BASE64 } from "./media-kit-font";

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
//
// Font independence (Nov 5 2026 fix): serverless runtimes ship without
// usable fonts, and anything routed through the system font stack
// degrades there: SVG <text> collapses to a strip of tiny
// missing-glyph marks. So this module carries its own font
// (lib/media-kit-font.ts):
//   - the business-name fallback is drawn as vector paths computed
//     from that font with opentype.js, never as SVG <text>, and
//   - the same font is registered with fontconfig below, so sponsor
//     SVG logos that contain live <text> can still rasterize.
// Logo rasters also get their transparent padding trimmed before the
// contain-fit, so a logo exported on an oversized transparent canvas
// fills its zone instead of shrinking to its artwork fraction.

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

/* ---------------- Bundled font + fontconfig ---------------- */

function bundledFontBytes(): Buffer {
  return Buffer.from(MEDIA_KIT_FONT_BASE64, "base64");
}

let cachedFont: Font | null = null;
function bundledFont(): Font {
  if (cachedFont) return cachedFont;
  const bytes = bundledFontBytes();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  cachedFont = parseFont(arrayBuffer);
  return cachedFont;
}

// Register the bundled font with fontconfig so librsvg/pango (used by
// sharp when rasterizing sponsor SVG logos) can find a real font even
// on servers that ship none. Best effort: wrapped in try/catch and
// idempotent. The name fallback does not depend on this (it is drawn
// as paths); this exists for SVG logos containing live <text>.
let fontConfigDone = false;
function ensureBundledFontConfig(): void {
  if (fontConfigDone) return;
  fontConfigDone = true;
  try {
    const dir = join(tmpdir(), "gist-media-kit-fonts");
    mkdirSync(dir, { recursive: true });
    const fontPath = join(dir, "DejaVuSans-Bold.ttf");
    if (!existsSync(fontPath)) writeFileSync(fontPath, bundledFontBytes());
    const cacheDir = join(dir, "cache");
    mkdirSync(cacheDir, { recursive: true });
    const confPath = join(dir, "fonts.conf");
    writeFileSync(
      confPath,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n` +
        `<fontconfig><dir>${dir}</dir><dir>/usr/share/fonts</dir><dir>/usr/local/share/fonts</dir>` +
        `<cachedir>${cacheDir}</cachedir></fontconfig>\n`
    );
    process.env.FONTCONFIG_FILE = confPath;
  } catch {
    // Silent: a fontless environment is still handled by the path-based
    // name fallback and the degenerate-render guard for SVG logos.
  }
}
ensureBundledFontConfig();

/* ---------------- Business-name fallback (vector paths) ---------------- */

// Business name as an SVG overlay sized for the logo zone. The glyphs
// are vector paths from the bundled font (opentype.js), so the render
// is identical on every server and never depends on installed fonts.
// Layout: one line when it fits at a strong size; otherwise the name
// wraps at a word boundary into two lines when that clearly wins.
// Lines are centered; if even the floor size overflows the zone width,
// the line is squeezed horizontally (paths scale cleanly) instead of
// shrinking below legibility.
export function nameFallbackSvg(businessName: string, widthPx: number, heightPx: number): Buffer {
  const name = businessName.trim() || "Community Partner";
  const font = bundledFont();
  const maxWidth = widthPx * 0.94;
  const advancePerPx = (text: string) => font.getAdvanceWidth(text, 100, { kerning: true }) / 100;
  const fitSize = (lines: string[], cap: number) => {
    const widest = Math.max(...lines.map((line) => advancePerPx(line)));
    return widest > 0 ? Math.min(cap, maxWidth / widest) : cap;
  };

  let lines = [name];
  let size = fitSize(lines, heightPx * 0.6);
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    let bestSplit: string[] | null = null;
    let bestWorst = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ");
      const b = words.slice(i).join(" ");
      const worst = Math.max(advancePerPx(a), advancePerPx(b));
      if (worst < bestWorst) {
        bestWorst = worst;
        bestSplit = [a, b];
      }
    }
    if (bestSplit) {
      const twoLineSize = fitSize(bestSplit, heightPx * 0.34);
      if (twoLineSize >= size * 1.35) {
        lines = bestSplit;
        size = twoLineSize;
      }
    }
  }

  const MIN_FONT_SIZE = 12;
  let squeeze = 1;
  if (size < MIN_FONT_SIZE) {
    for (const line of lines) {
      const adv = advancePerPx(line) * MIN_FONT_SIZE;
      if (adv > 0) squeeze = Math.min(squeeze, maxWidth / adv);
    }
    size = MIN_FONT_SIZE;
  }

  const ascent = (font.ascender / font.unitsPerEm) * size;
  const descent = (-font.descender / font.unitsPerEm) * size;
  const lineHeight = size * 1.22;
  const blockHeight = ascent + descent + (lines.length - 1) * lineHeight;
  let baseline = (heightPx - blockHeight) / 2 + ascent;

  const parts: string[] = [];
  for (const line of lines) {
    const adv = advancePerPx(line) * size;
    const d = font.getPath(line, 0, 0, size, { kerning: true }).toPathData(2);
    parts.push(
      `<g transform="translate(${(widthPx / 2).toFixed(1)} ${baseline.toFixed(1)}) scale(${squeeze.toFixed(3)} 1)">` +
        `<path d="${d}" transform="translate(${(-adv / 2).toFixed(1)} 0)" fill="#1f2937"/></g>`
    );
    baseline += lineHeight;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">${parts.join("")}</svg>`;
  return Buffer.from(svg);
}

/* ---------------- Logo overlay ---------------- */

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

function looksLikeSvg(raw: Buffer, url: string): boolean {
  if (/\.svg(\?|#|$)/i.test(url)) return true;
  const head = raw.subarray(0, 1024).toString("utf8");
  return /<svg[\s>]/i.test(head);
}

// Fraction of a raster actually covered by artwork, measured on the
// alpha channel (SVG rasters are transparent where nothing is drawn).
// Returns null when the image has no alpha channel to judge by.
async function measureContentFraction(
  buf: Buffer
): Promise<{ widthFraction: number; heightFraction: number } | null> {
  try {
    const img = sharp(buf).ensureAlpha();
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return null;
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * channels + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { widthFraction: 0, heightFraction: 0 };
    return {
      widthFraction: (maxX - minX + 1) / info.width,
      heightFraction: (maxY - minY + 1) / info.height,
    };
  } catch {
    return null;
  }
}

// Prepare a fetched logo for placement: SVG logos are rasterized
// (with a guard against the degenerate fontless-text render), and any
// logo on a transparent canvas gets its empty padding trimmed so the
// artwork itself fills the zone under the contain-fit.
async function prepareLogoRaster(
  raw: Buffer,
  logoUrl: string
): Promise<{ buffer: Buffer } | { degenerate: true }> {
  let work = raw;

  if (looksLikeSvg(raw, logoUrl)) {
    ensureBundledFontConfig();
    let raster = await sharp(raw).png().toBuffer();
    const rasterMeta = await sharp(raster).metadata();
    if ((rasterMeta.width || 0) > 2000) {
      raster = await sharp(raster).resize({ width: 2000 }).png().toBuffer();
    }
    const hasLiveText = /<text[\s>]/i.test(raw.toString("utf8", 0, 65536));
    if (hasLiveText) {
      // A live-text SVG depends on server fonts to rasterize. When the
      // environment cannot render text, the artwork collapses to a
      // tiny fraction of its canvas; detect that and let the caller
      // fall back to the business name instead of compositing specks.
      const fraction = await measureContentFraction(raster);
      if (fraction && (fraction.heightFraction < 0.05 || fraction.widthFraction < 0.05)) {
        return { degenerate: true };
      }
    }
    work = raster;
  }

  try {
    const meta = await sharp(work).metadata();
    if (meta.hasAlpha && meta.width && meta.height) {
      const corner = await sharp(work)
        .extract({ left: 0, top: 0, width: 1, height: 1 })
        .ensureAlpha()
        .raw()
        .toBuffer();
      if (corner[3] < 8) {
        const trimmed = await sharp(work).trim({ threshold: 10 }).png().toBuffer();
        const trimmedMeta = await sharp(trimmed).metadata();
        if ((trimmedMeta.width || 0) >= 8 && (trimmedMeta.height || 0) >= 8) {
          work = trimmed;
        }
      }
    }
  } catch {
    // Trimming is an optimization; the untrimmed raster still works.
  }

  return { buffer: work };
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
    const prepared = await prepareLogoRaster(raw, profile.logoUrl);
    if ("degenerate" in prepared) {
      return fallback("The sponsor's logo could not be used, so their business name was used instead.");
    }
    const resized = await sharp(prepared.buffer)
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
