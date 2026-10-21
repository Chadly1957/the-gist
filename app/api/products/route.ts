import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/products — active products for this workspace (public).
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
    },
  });
  return NextResponse.json({ products });
}
