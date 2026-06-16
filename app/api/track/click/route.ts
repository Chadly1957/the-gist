import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyTrackingUrl } from "@/lib/tracking";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const recipientId = searchParams.get("r");
  const target = searchParams.get("u");
  const type = searchParams.get("t") || "other";
  const label = searchParams.get("l");
  const signature = searchParams.get("s");

  if (!target || !signature || !verifyTrackingUrl(target, signature)) {
    return NextResponse.json({ error: "Invalid tracking link" }, { status: 400 });
  }

  if (recipientId) {
    try {
      await Promise.all([
        prisma.newsletterRecipient.update({
          where: { id: recipientId },
          data: { clickCount: { increment: 1 }, clickedAt: new Date() },
        }),
        prisma.linkClick.create({
          data: { newsletterRecipientId: recipientId, url: target, linkType: type, label },
        }),
      ]);
    } catch {
      // Unknown recipient (e.g. stale link) — still honor the redirect.
    }
  }

  return NextResponse.redirect(target, { status: 302 });
}
