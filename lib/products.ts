// Shared product-order recording. Used by the Stripe webhook (both the
// first-party checkout flow and the legacy Payment Link flow) and by the
// admin Payment Link sync. Idempotent by design: orders are upserted on the
// unique Stripe checkout session ID, so webhook redeliveries and repeated
// syncs never double-count a sale.
import type { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import type { Block, ProductSpotlightItem } from "./template-renderer";

// Resolve the products selected in a template's product_spotlight blocks
// into render-ready items, keyed by product ID. Only ACTIVE products in the
// current workspace resolve (the shared prisma client is workspace-scoped);
// a missing or inactive selection is simply absent from the map and its
// block renders empty. Sold out follows the public product pages: paid
// orders at or past the quantity cap. Wrapped so a data problem can never
// block a send — on any error the blocks just render empty.
export async function resolveProductSpotlightItems(
  blocks: Block[],
  appUrl: string
): Promise<Map<string, ProductSpotlightItem>> {
  const items = new Map<string, ProductSpotlightItem>();
  const ids = Array.from(
    new Set(
      blocks
        .filter((b) => b.type === "product_spotlight")
        .map((b) => String(b.content.productId || ""))
        .filter(Boolean)
    )
  );
  if (ids.length === 0) return items;
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, status: "active" },
    });
    if (products.length === 0) return items;
    const paidCounts = await prisma.productOrder.groupBy({
      by: ["productId"],
      where: { status: "paid", productId: { in: ids } },
      _count: { _all: true },
    });
    const paidById = new Map(paidCounts.map((c) => [c.productId, c._count._all]));
    for (const p of products) {
      const paid = paidById.get(p.id) ?? 0;
      items.set(p.id, {
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        imageUrl: p.imageUrl,
        url: `${appUrl}/products/${p.slug}`,
        soldOut: p.quantity !== null && paid >= p.quantity,
      });
    }
  } catch {
    // Product tables unavailable — product blocks render empty.
    return new Map();
  }
  return items;
}

type ProductOrderDb = Pick<PrismaClient, "productOrder">;

export async function recordPaidProductOrder(
  db: ProductOrderDb,
  args: {
    workspaceId: string;
    productId: string;
    email: string;
    amountCents: number;
    sessionId: string;
    paidAt?: Date;
  }
): Promise<{ created: boolean }> {
  const existing = await db.productOrder.findUnique({
    where: { stripeSessionId: args.sessionId },
    select: { id: true, status: true },
  });
  if (existing) {
    if (existing.status !== "paid") {
      await db.productOrder.update({
        where: { id: existing.id },
        data: { status: "paid", paidAt: args.paidAt ?? new Date() },
      });
    }
    return { created: false };
  }
  await db.productOrder.create({
    data: {
      workspaceId: args.workspaceId,
      productId: args.productId,
      email: args.email,
      amountCents: args.amountCents,
      stripeSessionId: args.sessionId,
      status: "paid",
      paidAt: args.paidAt ?? new Date(),
    },
  });
  return { created: true };
}
