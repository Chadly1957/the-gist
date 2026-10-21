import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/products/[slug] — one active product's public marketing data.
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
    },
  });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json({ product });
}
