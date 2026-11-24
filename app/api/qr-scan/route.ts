import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { QR_CODES, deviceFromUa, isBotUa } from "@/lib/qr-scan";

export const dynamic = "force-dynamic";

// POST /api/qr-scan — internal logging endpoint for the two tracked printed
// QR codes. Called in the background by middleware (event.waitUntil); it is
// public by design, so the payload is validated strictly: the code must be
// one of the two known codes and the UTM triple must match it exactly.
// Anything else is rejected. No IPs, no personal data, ever.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { code, utmSource, utmMedium, utmCampaign, userAgent } =
    (body ?? {}) as Record<string, unknown>;
  const def = QR_CODES.find((q) => q.code === code);
  if (
    !def ||
    utmSource !== def.utmSource ||
    utmMedium !== def.utmMedium ||
    utmCampaign !== def.utmCampaign
  ) {
    return NextResponse.json({ error: "unknown code" }, { status: 400 });
  }
  const ua = typeof userAgent === "string" ? userAgent : "";
  // Link-preview and crawler fetches are not scans.
  if (isBotUa(ua)) return NextResponse.json({ ok: true, skipped: "bot" });
  try {
    // workspaceId is stamped by the workspace-isolation extension from the
    // request host, so it is deliberately not passed here.
    await prisma.qrScan.create({
      data: {
        code: def.code,
        utmSource: def.utmSource,
        utmMedium: def.utmMedium,
        utmCampaign: def.utmCampaign,
        device: deviceFromUa(ua),
      },
    });
  } catch {
    // Logging must never break the page; a failed write is dropped silently.
  }
  return NextResponse.json({ ok: true });
}
