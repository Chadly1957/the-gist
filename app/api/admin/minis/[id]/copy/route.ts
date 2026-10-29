import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// POST /api/admin/minis/[id]/copy — copy a guide into another workspace as
// an INACTIVE draft, ready to localize (Phase 2 spec, localization). Uses
// basePrisma because the write lands in a different workspace than the
// admin session's; the source must belong to the current workspace and the
// target must be a real, different workspace.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { targetWorkspaceId?: string };
  const targetWorkspaceId = typeof body.targetWorkspaceId === "string" ? body.targetWorkspaceId : "";
  if (!targetWorkspaceId) return NextResponse.json({ error: "Choose a city to copy to." }, { status: 400 });

  const current = await getWorkspace();
  if (targetWorkspaceId === current.id) {
    return NextResponse.json({ error: "That is this guide's own city." }, { status: 400 });
  }

  const source = await basePrisma.mini.findFirst({
    where: { id, workspaceId: current.id },
  });
  if (!source) return NextResponse.json({ error: "Guide not found in this city." }, { status: 404 });

  const target = await basePrisma.workspace.findUnique({
    where: { id: targetWorkspaceId },
    select: { id: true, name: true },
  });
  if (!target) return NextResponse.json({ error: "That city does not exist." }, { status: 400 });

  // Same slug if free in the target workspace, numeric suffix if not.
  let slug = source.slug;
  const base = slug;
  let n = 2;
  while (
    await basePrisma.mini.findFirst({
      where: { workspaceId: target.id, slug },
      select: { id: true },
    })
  ) {
    slug = `${base}-${n++}`;
  }

  const copy = await basePrisma.mini.create({
    data: {
      workspaceId: target.id,
      slug,
      title: source.title,
      question: source.question,
      content: (source.content ?? []) as never,
      priceCents: source.priceCents,
      active: false,
    },
  });
  return NextResponse.json({ ok: true, copy, targetName: target.name });
}
