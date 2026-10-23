import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deriveExcerpt, sanitizeArticleHtml, slugify } from "@/lib/articles";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["draft", "published"];
const DEFAULT_AUTHOR = "Chad Williams";

interface StoryBody {
  headline?: string;
  slug?: string;
  author?: string;
  headerImageUrl?: string | null;
  body?: string;
  excerpt?: string | null;
  status?: string;
}

// GET /api/admin/stories — list this workspace's stories, newest first.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stories = await prisma.story.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ stories });
}

// POST /api/admin/stories — create a story. Slug auto-generates from the
// headline when not supplied; collisions get a numeric suffix.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as StoryBody;
  const headline = body.headline?.trim();
  if (!headline) return NextResponse.json({ error: "Headline is required." }, { status: 400 });
  const bodyHtml = sanitizeArticleHtml(body.body || "");
  if (!bodyHtml) return NextResponse.json({ error: "Write the article body first." }, { status: 400 });
  const status = body.status && VALID_STATUS.includes(body.status) ? body.status : "draft";

  let slug = slugify(body.slug?.trim() || headline);
  if (!slug) return NextResponse.json({ error: "Could not generate a URL slug from that headline." }, { status: 400 });
  const base = slug;
  let n = 2;
  while (await prisma.story.findFirst({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${n++}`;
  }

  const excerpt = body.excerpt?.trim() || deriveExcerpt(bodyHtml);

  const story = await prisma.story.create({
    data: {
      headline,
      slug,
      author: body.author?.trim() || DEFAULT_AUTHOR,
      headerImageUrl: body.headerImageUrl?.trim() || null,
      body: bodyHtml,
      excerpt,
      status,
      publishedAt: status === "published" ? new Date() : null,
    },
  });
  return NextResponse.json({ ok: true, story });
}
