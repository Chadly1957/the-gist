import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import {
  MINI_PRICE_CENTS,
  MINI_SLUG_RE,
  cleanMiniImageUrl,
  countMiniOptions,
  sanitizeMiniBlocks,
  type MiniBlock,
} from "@/lib/minis";

export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

interface MiniBody {
  title?: string;
  slug?: string;
  question?: string;
  content?: unknown;
  active?: boolean;
  imageUrl?: string | null;
}

// Shared create/update validation. Returns either the cleaned fields or an
// error message. The price is never taken from the client: Minis are $5,
// set from MINI_PRICE_CENTS (Phase 1 pricing decision).
function validateMiniBody(body: MiniBody): {
  data?: {
    title: string;
    slug: string;
    question: string;
    content: MiniBlock[];
    active: boolean;
    imageUrl: string | null;
  };
  error?: string;
} {
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) return { error: "Title is required." };
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 200) : "";
  if (!question) return { error: "The question this guide answers is required." };
  const slug = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : title);
  if (!slug || !MINI_SLUG_RE.test(slug)) {
    return { error: "Slug must be lowercase letters, numbers, and hyphens." };
  }
  const { blocks, error } = sanitizeMiniBlocks(body.content ?? []);
  if (error || !blocks) return { error: error || "Invalid guide content." };
  const image = cleanMiniImageUrl(body.imageUrl);
  if (image.error) return { error: image.error };
  const active = body.active === true;
  if (active && countMiniOptions(blocks) === 0) {
    return { error: "An active guide needs at least one option. Add an option or save it inactive." };
  }
  return {
    data: {
      title,
      slug,
      question,
      content: blocks,
      active,
      imageUrl: image.imageUrl ?? null,
    },
  };
}

// GET /api/admin/minis — list this workspace's Minis, newest first, with
// purchase counts. Uses basePrisma with an explicit workspaceId (the Phase
// 1 pattern in lib/minis.ts): the Mini model's workspaceId has no schema
// default, so the workspace-scoped client's create input will not compile
// without it.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace();
  const minis = await basePrisma.mini.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { purchases: true } } },
  });
  return NextResponse.json({
    minis: minis.map((m) => ({ ...m, purchaseCount: m._count.purchases, _count: undefined })),
  });
}

// POST /api/admin/minis — create a Mini in the current workspace. Slug
// collisions in this workspace get a numeric suffix, like Products.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as MiniBody;
  const { data, error } = validateMiniBody(body);
  if (error || !data) return NextResponse.json({ error }, { status: 400 });

  const workspace = await getWorkspace();
  let slug = data.slug;
  const base = slug;
  let n = 2;
  while (
    await basePrisma.mini.findFirst({
      where: { workspaceId: workspace.id, slug },
      select: { id: true },
    })
  ) {
    slug = `${base}-${n++}`;
  }

  const mini = await basePrisma.mini.create({
    data: {
      workspaceId: workspace.id,
      title: data.title,
      slug,
      question: data.question,
      content: data.content,
      priceCents: MINI_PRICE_CENTS,
      imageUrl: data.imageUrl,
      active: data.active,
    },
  });
  return NextResponse.json({ ok: true, mini });
}
