// Shared product-order recording. Used by the Stripe webhook (both the
// first-party checkout flow and the legacy Payment Link flow) and by the
// admin Payment Link sync. Idempotent by design: orders are upserted on the
// unique Stripe checkout session ID, so webhook redeliveries and repeated
// syncs never double-count a sale.
import type { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "./db";
import type { Block, ProductSpotlightItem } from "./template-renderer";

// Shipping address as stored on a ProductOrder (column names match the
// schema). Extracted from the Stripe Checkout session at payment time.
export interface ProductShipping {
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
}

// Pull the buyer's shipping name + address off a completed Checkout
// session. The current Stripe API returns it at
// collected_information.shipping_details; older API versions put it at the
// top-level shipping_details, so check both. Returns null when the session
// collected no address (digital product, or a link with collection off).
export function shippingFromSession(session: Stripe.Checkout.Session): ProductShipping | null {
  const s = session as unknown as {
    collected_information?: { shipping_details?: Stripe.Checkout.Session.CollectedInformation.ShippingDetails | null } | null;
    shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null;
  };
  const details = s.collected_information?.shipping_details ?? s.shipping_details;
  const address = details?.address;
  if (!details || !address) return null;
  return {
    shippingName: details.name || null,
    shippingLine1: address.line1 || null,
    shippingLine2: address.line2 || null,
    shippingCity: address.city || null,
    shippingState: address.state || null,
    shippingPostalCode: address.postal_code || null,
    shippingCountry: address.country || null,
  };
}

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
        remaining: p.quantity !== null ? Math.max(0, p.quantity - paid) : null,
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
    shipping?: ProductShipping | null;
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
        data: { status: "paid", paidAt: args.paidAt ?? new Date(), ...(args.shipping ?? {}) },
      });
    } else if (args.shipping) {
      // Already recorded as paid: still fill in the shipping address when
      // the caller has it (e.g. a Payment Link sync backfilling orders that
      // were created before addresses were stored).
      await db.productOrder.update({
        where: { id: existing.id },
        data: { ...args.shipping },
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
      ...(args.shipping ?? {}),
    },
  });
  return { created: true };
}
