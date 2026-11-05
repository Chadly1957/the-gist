// Shared types and defaults for the Media Kit Builder. Pure module (no
// imports), safe from server code, API routes, and the admin client UI,
// same pattern as lib/sponsor-slug.ts.
//
// A zone is a rectangle in relative coordinates (0-1) against the
// template image's own dimensions: { x, y } is the top-left corner and
// { w, h } the size, all as fractions of the image width/height.

export interface MediaKitZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MediaKitKind = "flyer" | "social";

export const MEDIA_KIT_KINDS: MediaKitKind[] = ["flyer", "social"];

export function isMediaKitKind(value: unknown): value is MediaKitKind {
  return value === "flyer" || value === "social";
}

// Sensible starting placements so a fresh template is usable before the
// admin fine-tunes: logo across the top, QR in the bottom-right corner.
// The QR default is square against a 1000x1000 canvas; the zone editor
// re-squares it against the real image aspect on first drag, and the
// composer always renders the QR itself square regardless.
export const DEFAULT_QR_ZONE: MediaKitZone = { x: 0.76, y: 0.72, w: 0.2, h: 0.2 };
export const DEFAULT_LOGO_ZONE: MediaKitZone = { x: 0.3, y: 0.04, w: 0.4, h: 0.16 };

export function isValidZone(value: unknown): value is MediaKitZone {
  if (!value || typeof value !== "object") return false;
  const z = value as Record<string, unknown>;
  for (const key of ["x", "y", "w", "h"] as const) {
    if (typeof z[key] !== "number" || !Number.isFinite(z[key] as number)) return false;
  }
  const zone = z as unknown as MediaKitZone;
  return (
    zone.x >= 0 &&
    zone.y >= 0 &&
    zone.w >= 0.02 &&
    zone.h >= 0.02 &&
    zone.x + zone.w <= 1.001 &&
    zone.y + zone.h <= 1.001
  );
}

export function clampZone(zone: MediaKitZone): MediaKitZone {
  const w = Math.min(Math.max(zone.w, 0.02), 1);
  const h = Math.min(Math.max(zone.h, 0.02), 1);
  return {
    w,
    h,
    x: Math.min(Math.max(zone.x, 0), 1 - w),
    y: Math.min(Math.max(zone.y, 0), 1 - h),
  };
}
