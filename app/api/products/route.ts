import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/products — active products for this workspace (public), each with
// its sold-out state derived from paid orders vs. its quantity cap.
export async function GET() {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      priceCents: true,
      compareAtCents: true,
      imageUrl: true,
      quantity: true,
    },
  });
  const paidCounts = await prisma.productOrder.groupBy({
    by: ["productId"],
    where: { status: "paid" },
    _count: { _all: true },
  });
  const paidById = new Map(paidCounts.map((c) => [c.productId, c._count._all]));
  return NextResponse.json({
    products: products.map((p) => {
      const paid = paidById.get(p.id) ?? 0;
      const soldOut = p.quantity !== null && paid >= p.quantity;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        tagline: p.tagline,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        imageUrl: p.imageUrl,
        soldOut,
        remaining: p.quantity !== null ? Math.max(0, p.quantity - paid) : null,
      };
    }),
  });
}
