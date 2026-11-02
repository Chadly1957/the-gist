import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyTrackingUrl } from "@/lib/tracking";

export const dynamic = "force-dynamic";

// Click tracking for sponsor nurture emails. Mirrors /api/track/click
// (HMAC-signed target so the redirect can't be forged) but records
// against the nurture send instead of a newsletter recipient.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sendId = searchParams.get("r");
  const target = searchParams.get("u");
  const label = searchParams.get("t") || "other";
  const signature = searchParams.get("s");

  if (!target || !signature || !verifyTrackingUrl(target, signature)) {
    return NextResponse.json({ error: "Invalid tracking link" }, { status: 400 });
  }

  if (sendId) {
    try {
      const send = await prisma.sponsorNurtureSend.findUnique({
        where: { id: sendId },
        select: { workspaceId: true },
      });
      if (send) {
        await Promise.all([
          prisma.sponsorNurtureSend.update({
            where: { id: sendId },
            data: { clickCount: { increment: 1 }, clickedAt: new Date() },
          }),
          prisma.sponsorNurtureClick.create({
            data: { workspaceId: send.workspaceId, sendId, url: target, label },
          }),
        ]);
      }
    } catch {
      // Unknown send (e.g. stale link) — still honor the redirect.
    }
  }

  return NextResponse.redirect(target, { status: 302 });
}
