// Shared product-order recording. Used by the Stripe webhook (both the
// first-party checkout flow and the legacy Payment Link flow) and by the
// admin Payment Link sync. Idempotent by design: orders are upserted on the
// unique Stripe checkout session ID, so webhook redeliveries and repeated
// syncs never double-count a sale.
import type { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "./db";
import { COUPON_BOOK_PRICE_CENTS } from "./coupon-book";
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

// Resolve the selections in a template's product_spotlight blocks into
// render-ready items. A block features one of three things, picked by its
// featureType content field (absent means "product", so every saved
// template resolves exactly as before):
//   - "product": an ACTIVE product in the current workspace, keyed by
//     product ID. Sold out follows the public product pages: paid orders
//     at or past the quantity cap.
//   - "guide": an ACTIVE Deals guide (Mini) in the current workspace,
//     keyed `guide:<miniId>`, rendered through the same card with a
//     price note.
//   - "deals": The Gist Deals book, keyed "deals", priced from the shared
//     coupon-book constant.
// A missing or inactive selection is simply absent from the map and its
// block renders empty. Wrapped so a data problem can never block a send —
// on any error the blocks just render empty.
export async function resolveProductSpotlightItems(
  blocks: Block[],
  appUrl: string
): Promise<Map<string, ProductSpotlightItem>> {
  const items = new Map<string, ProductSpotlightItem>();
  const spotlightBlocks = blocks.filter((b) => b.type === "product_spotlight");
  const featureTypeOf = (b: Block) => String(b.content.featureType || "product");
  const ids = Array.from(
    new Set(
      spotlightBlocks
        .filter((b) => featureTypeOf(b) === "product")
        .map((b) => String(b.content.productId || ""))
        .filter(Boolean)
    )
  );
  const miniIds = Array.from(
    new Set(
      spotlightBlocks
        .filter((b) => featureTypeOf(b) === "guide")
        .map((b) => String(b.content.miniId || ""))
        .filter(Boolean)
    )
  );
  const wantsDeals = spotlightBlocks.some((b) => featureTypeOf(b) === "deals");
  if (ids.length === 0 && miniIds.length === 0 && !wantsDeals) return items;
  try {
    if (ids.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: ids }, status: "active" },
      });
      if (products.length > 0) {
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
      }
    }
    if (miniIds.length > 0) {
      // Same scoped prisma client as the product query above, so the
      // workspace scoping matches; only ACTIVE Minis resolve.
      const minis = await prisma.mini.findMany({
        where: { id: { in: miniIds }, active: true },
        select: { id: true, title: true, question: true, slug: true, priceCents: true },
      });
      for (const m of minis) {
        items.set(`guide:${m.id}`, {
          name: m.title,
          tagline: m.question,
          priceCents: m.priceCents,
          priceNote: "one time · Free with The Gist Deals",
          imageUrl: null,
          url: `${appUrl}/minis/${m.slug}`,
          soldOut: false,
          remaining: null,
        });
      }
    }
    if (wantsDeals) {
      items.set("deals", {
        name: "The Gist Deals",
        tagline: "Every deal worth knowing about, in one little book on your phone.",
        priceCents: COUPON_BOOK_PRICE_CENTS,
        priceNote: "a year · cancel anytime",
        imageUrl: null,
        url: `${appUrl}/deals`,
        soldOut: false,
        remaining: null,
      });
    }
  } catch {
    // Spotlight data unavailable — spotlight blocks render empty.
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
