import crypto from "crypto";

// Same secret family as admin session signing (lib/auth.ts) — fine to reuse
// since this only needs to prevent forged redirect targets, not auth.
const SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-32chars";

export function signTrackingUrl(url: string): string {
  return crypto.createHmac("sha256", SECRET).update(url).digest("hex").slice(0, 16);
}

export function verifyTrackingUrl(url: string, signature: string): boolean {
  return signTrackingUrl(url) === signature;
}
