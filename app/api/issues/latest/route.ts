import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/issues/latest — the latest sent issue for this workspace
// (public; issues are public). Workspace scoping comes from @/lib/db,
// which resolves the request workspace from the /w/ path prefix or the
// hostname and falls back to Decatur. Returns { issue: null } when no sent
// issue has an HTML snapshot, so the caller can fall back to the hero photo.
export async function GET() {
  const send = await prisma.newsletterSend.findFirst({
    where: { status: "sent", htmlSnapshot: { not: null } },
    select: { subject: true, sentAt: true, htmlSnapshot: true },
    orderBy: { sentAt: "desc" },
  });

  if (!send || !send.htmlSnapshot) {
    return NextResponse.json({ issue: null });
  }

  return NextResponse.json({
    issue: {
      subject: send.subject,
      sentAt: send.sentAt.toISOString(),
      html: send.htmlSnapshot,
    },
  });
}
