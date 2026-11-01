import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/articles/[slug]/view — view beacon for original articles.
// Published stories only (workspace-scoped by lib/db). The client dedupes
// to one count per reader session; there is deliberately no auth here
// because it is a public page-view ping, and the worst case of abuse is a
// vanity counter drifting, not data loss.
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await prisma.story.findFirst({
    where: { slug, status: "published" },
    select: { id: true },
  });
  if (!story) return NextResponse.json({ ok: false }, { status: 404 });

  await prisma.story.update({
    where: { id: story.id },
    data: { viewCount: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
