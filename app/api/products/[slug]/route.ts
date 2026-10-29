import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/products/[slug] — one active product's public marketing data,
// including sold-out state from paid orders vs. its quantity cap.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { slug, status: "active" },
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      description: true,
      priceCents: true,
      compareAtCents: true,
      imageUrl: true,
      galleryUrls: true,
      fulfillmentNote: true,
      offersSizes: true,
      quantity: true,
    },
  });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  let soldOut = false;
  let remaining: number | null = null;
  if (product.quantity !== null) {
    const paid = await prisma.productOrder.count({
      where: { productId: product.id, status: "paid" },
    });
    soldOut = paid >= product.quantity;
    remaining = Math.max(0, product.quantity - paid);
  }
  const { quantity: _quantity, ...pub } = product;
  return NextResponse.json({ product: { ...pub, soldOut, remaining } });
}
