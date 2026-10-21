// Shared product-order recording. Used by the Stripe webhook (both the
// first-party checkout flow and the legacy Payment Link flow) and by the
// admin Payment Link sync. Idempotent by design: orders are upserted on the
// unique Stripe checkout session ID, so webhook redeliveries and repeated
// syncs never double-count a sale.
import type { PrismaClient } from "@prisma/client";

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
