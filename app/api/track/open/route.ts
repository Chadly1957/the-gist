import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);

export async function GET(req: NextRequest) {
  const recipientId = new URL(req.url).searchParams.get("r");

  if (recipientId) {
    try {
      const recipient = await prisma.newsletterRecipient.findUnique({ where: { id: recipientId } });
      if (recipient) {
        await prisma.newsletterRecipient.update({
          where: { id: recipientId },
          data: {
            openCount: { increment: 1 },
            openedAt: recipient.openedAt ?? new Date(),
          },
        });
      }
    } catch {
      // Unknown recipient — still return the pixel so the email renders cleanly.
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
