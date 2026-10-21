import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

interface ProductBody {
  name?: string;
  slug?: string;
  tagline?: string;
  description?: string;
  priceCents?: number;
  compareAtCents?: number | null;
  imageUrl?: string | null;
  galleryUrls?: string[];
  fulfillmentNote?: string;
  quantity?: number | null;
  stripePaymentLinkId?: string | null;
  status?: string;
}

const VALID_STATUS = ["draft", "active", "archived"];

// GET /api/admin/products — list this workspace's products, newest first,
// with paid-order counts.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });
  const paidCounts = await prisma.productOrder.groupBy({
    by: ["productId"],
    where: { status: "paid" },
    _count: { _all: true },
  });
  const paidById = new Map(paidCounts.map((c) => [c.productId, c._count._all]));
  return NextResponse.json({
    products: products.map((p) => ({
      ...p,
      orderCount: p._count.orders,
      paidCount: paidById.get(p.id) ?? 0,
      _count: undefined,
    })),
  });
}

// POST /api/admin/products — create a product. Slug auto-generates from the
// name when not supplied; collisions get a numeric suffix.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ProductBody;
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const priceCents = Math.round(Number(body.priceCents) || 0);
  if (priceCents <= 0) return NextResponse.json({ error: "Price must be greater than zero." }, { status: 400 });
  const status = body.status && VALID_STATUS.includes(body.status) ? body.status : "draft";
  let quantity: number | null = null;
  if (body.quantity !== undefined && body.quantity !== null) {
    quantity = Math.floor(Number(body.quantity));
    if (!Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Quantity must be zero or more (leave blank for unlimited)." }, { status: 400 });
    }
  }

  let slug = slugify(body.slug?.trim() || name);
  if (!slug) return NextResponse.json({ error: "Could not generate a URL slug from that name." }, { status: 400 });
  // Ensure the slug is unique in this workspace.
  const base = slug;
  let n = 2;
  while (await prisma.product.findFirst({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${n++}`;
  }

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      tagline: body.tagline?.trim() || null,
      description: body.description?.trim() || null,
      priceCents,
      compareAtCents: body.compareAtCents ? Math.round(Number(body.compareAtCents)) : null,
      imageUrl: body.imageUrl?.trim() || null,
      galleryUrls: Array.isArray(body.galleryUrls) ? body.galleryUrls.filter(Boolean).slice(0, 6) : [],
      fulfillmentNote: body.fulfillmentNote?.trim() || null,
      quantity,
      stripePaymentLinkId: body.stripePaymentLinkId?.trim() || null,
      status,
    },
  });
  return NextResponse.json({ ok: true, product });
}
