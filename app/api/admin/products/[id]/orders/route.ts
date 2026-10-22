import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/products/[id]/orders — the product's paid orders, oldest
// first, with the shipping address captured at checkout (when the buyer
// gave one) so fulfillment is a single readable list.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const orders = await prisma.productOrder.findMany({
    where: { productId: id, status: "paid" },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      email: true,
      amountCents: true,
      paidAt: true,
      shippingName: true,
      shippingLine1: true,
      shippingLine2: true,
      shippingCity: true,
      shippingState: true,
      shippingPostalCode: true,
      shippingCountry: true,
    },
  });
  return NextResponse.json({ orders });
}
