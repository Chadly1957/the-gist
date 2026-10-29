import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  MINI_PRICE_CENTS,
  MINI_SLUG_RE,
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
}

// Shared create/update validation. Returns either the cleaned fields or an
// error message. The price is never taken from the client: Minis are $5,
// set from MINI_PRICE_CENTS (Phase 1 pricing decision).
function validateMiniBody(body: MiniBody): {
  data?: { title: string; slug: string; question: string; content: MiniBlock[]; active: boolean };
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
    },
  };
}

// GET /api/admin/minis — list this workspace's Minis (the scoped prisma
// client filters by the admin's current workspace), newest first, with
// purchase counts.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const minis = await prisma.mini.findMany({
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

  let slug = data.slug;
  const base = slug;
  let n = 2;
  while (await prisma.mini.findFirst({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${n++}`;
  }

  const mini = await prisma.mini.create({
    data: {
      title: data.title,
      slug,
      question: data.question,
      content: data.content,
      priceCents: MINI_PRICE_CENTS,
      active: data.active,
    },
  });
  return NextResponse.json({ ok: true, mini });
}
