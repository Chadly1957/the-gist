import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import {
  MINI_SLUG_RE,
  cleanMiniImageUrl,
  countMiniOptions,
  sanitizeMiniBlocks,
  type MiniBlock,
} from "@/lib/minis";

export const dynamic = "force-dynamic";

// GET /api/admin/minis/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const workspace = await getWorkspace();
  const mini = await basePrisma.mini.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!mini) return NextResponse.json({ error: "Guide not found." }, { status: 404 });
  return NextResponse.json({ mini });
}

// PATCH /api/admin/minis/[id] — update any editable field. Unlike Products,
// the slug IS editable here (Phase 2 spec): guide links are young and Chad
// renames guides while localizing them. Uniqueness is enforced per
// workspace, excluding this Mini.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const workspace = await getWorkspace();
  const existing = await basePrisma.mini.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!existing) return NextResponse.json({ error: "Guide not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 120);
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    data.title = title;
  }
  if (typeof body.question === "string") {
    const question = body.question.trim().slice(0, 200);
    if (!question) return NextResponse.json({ error: "The question this guide answers is required." }, { status: 400 });
    data.question = question;
  }
  if (typeof body.slug === "string") {
    const slug = body.slug.trim().toLowerCase().slice(0, 60);
    if (!MINI_SLUG_RE.test(slug)) {
      return NextResponse.json({ error: "Slug must be lowercase letters, numbers, and hyphens." }, { status: 400 });
    }
    const clash = await basePrisma.mini.findFirst({
      where: { workspaceId: workspace.id, slug, NOT: { id } },
      select: { id: true },
    });
    if (clash) return NextResponse.json({ error: "That slug is already used by another guide in this city." }, { status: 400 });
    data.slug = slug;
  }

  let nextContent: MiniBlock[] = Array.isArray(existing.content)
    ? (existing.content as unknown as MiniBlock[])
    : [];
  if (body.content !== undefined) {
    const { blocks, error } = sanitizeMiniBlocks(body.content);
    if (error || !blocks) return NextResponse.json({ error: error || "Invalid guide content." }, { status: 400 });
    nextContent = blocks;
    data.content = nextContent;
  }

  if (body.imageUrl !== undefined) {
    const image = cleanMiniImageUrl(body.imageUrl);
    if (image.error) return NextResponse.json({ error: image.error }, { status: 400 });
    data.imageUrl = image.imageUrl ?? null;
  }

  if (typeof body.active === "boolean") data.active = body.active;

  // An active guide needs at least one option (checked against the
  // resulting state, so deactivating is never blocked by content edits).
  const nextActive = typeof data.active === "boolean" ? data.active : existing.active;
  if (nextActive && countMiniOptions(nextContent) === 0) {
    return NextResponse.json(
      { error: "An active guide needs at least one option. Add an option or save it inactive." },
      { status: 400 },
    );
  }

  const mini = await basePrisma.mini.update({ where: { id }, data });
  return NextResponse.json({ ok: true, mini });
}
