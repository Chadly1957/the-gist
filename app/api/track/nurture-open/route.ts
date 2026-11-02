import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF (same pixel as the newsletter open tracker).
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);

// Open tracking for sponsor nurture emails: ?r=<SponsorNurtureSend id>.
export async function GET(req: NextRequest) {
  const sendId = new URL(req.url).searchParams.get("r");

  if (sendId) {
    try {
      const send = await prisma.sponsorNurtureSend.findUnique({ where: { id: sendId } });
      if (send) {
        await prisma.sponsorNurtureSend.update({
          where: { id: sendId },
          data: {
            openCount: { increment: 1 },
            openedAt: send.openedAt ?? new Date(),
          },
        });
      }
    } catch {
      // Unknown send — still return the pixel so the email renders cleanly.
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
