import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deriveExcerpt, sanitizeArticleHtml, slugify } from "@/lib/articles";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["draft", "published"];

// GET /api/admin/stories/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  return NextResponse.json({ story });
}

// PATCH /api/admin/stories/[id] — update any editable field, incl. status.
// Publishing stamps publishedAt the first time; the slug stays editable
// here (unlike products) because Chad may fix a headline before sharing,
// and a taken slug is rejected rather than silently changed.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.story.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Article not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.headline === "string") {
    const headline = body.headline.trim();
    if (!headline) return NextResponse.json({ error: "Headline is required." }, { status: 400 });
    data.headline = headline;
  }
  if (typeof body.slug === "string") {
    const slug = slugify(body.slug);
    if (!slug) return NextResponse.json({ error: "Slug cannot be empty." }, { status: 400 });
    if (slug !== existing.slug) {
      const clash = await prisma.story.findFirst({ where: { slug }, select: { id: true } });
      if (clash) return NextResponse.json({ error: "That slug is already used by another article." }, { status: 409 });
      data.slug = slug;
    }
  }
  if (typeof body.author === "string") data.author = body.author.trim() || "Chad Williams";
  if (body.headerImageUrl !== undefined) {
    data.headerImageUrl = typeof body.headerImageUrl === "string" && body.headerImageUrl.trim() ? body.headerImageUrl.trim() : null;
  }
  if (typeof body.body === "string") {
    const bodyHtml = sanitizeArticleHtml(body.body);
    if (!bodyHtml) return NextResponse.json({ error: "The article body cannot be empty." }, { status: 400 });
    data.body = bodyHtml;
  }
  if (body.excerpt !== undefined) {
    // An emptied excerpt re-derives from the (possibly just-updated) body.
    const text = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
    data.excerpt = text || deriveExcerpt((data.body as string) || existing.body);
  }
  // Optional SEO overrides: sending the field at all updates it, and an
  // emptied value clears back to the automatic fallback (null).
  if (body.seoTitle !== undefined) {
    data.seoTitle = typeof body.seoTitle === "string" && body.seoTitle.trim() ? body.seoTitle.trim() : null;
  }
  if (body.seoDescription !== undefined) {
    data.seoDescription =
      typeof body.seoDescription === "string" && body.seoDescription.trim() ? body.seoDescription.trim() : null;
  }
  if (typeof body.status === "string") {
    if (!VALID_STATUS.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    data.status = body.status;
    if (body.status === "published" && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  const story = await prisma.story.update({ where: { id }, data });
  return NextResponse.json({ ok: true, story });
}
