import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// POST /api/admin/sponsors/invoices/[id]/cancel
// Cancels an UNPAID admin-sent invoice and releases whatever it was
// holding:
// - Campaign: voids the Stripe invoice and deletes the still-pending
//   booking, so the run slot frees up.
// - Premium / Starred: cancels the Stripe subscription immediately and
//   deletes the still-pending subscription row, so the duplicate guard
//   (and, for Starred, the cap spot) frees up.
// A PAID invoice is refused here: a live Premium/Starred subscription is
// ended with the existing Cancel buttons on the Spotlights tab (which
// run it to the end of its paid month), and a paid campaign already ran
// its fulfillment.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { id: workspaceId } = await getWorkspace();
  const record = await basePrisma.sponsorInvoice.findFirst({ where: { id, workspaceId } });
  if (!record) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (record.status === "paid") {
    return NextResponse.json(
      { error: "This invoice is already paid. Use the item's own cancel action instead." },
      { status: 409 }
    );
  }
  if (record.status === "void" || record.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

  if (record.kind === "sponsor_week") {
    if (stripe) {
      try {
        await stripe.invoices.voidInvoice(record.stripeInvoiceId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Stripe void failed";
        // Already void / already paid in Stripe: keep going locally only
        // when it is void; a paid-in-Stripe surprise must surface.
        if (!/already.*void|voided/i.test(msg)) {
          return NextResponse.json({ error: msg }, { status: 502 });
        }
      }
    }
    if (record.bookingId) {
      const booking = await basePrisma.sponsorWeekBooking.findFirst({
        where: { id: record.bookingId, workspaceId },
        select: { status: true },
      });
      // Only a still-pending booking is released; a paid one fulfilled
      // already and is not this action's business.
      if (booking?.status === "pending_payment") {
        await basePrisma.sponsorWeekBooking.delete({ where: { id: record.bookingId } });
      }
    }
    await basePrisma.sponsorInvoice.update({
      where: { id: record.id },
      data: { status: "void" },
    });
    return NextResponse.json({ ok: true });
  }

  // Monthly items.
  if (stripe && record.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(record.stripeSubscriptionId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Stripe cancel failed";
      if (!/no such subscription|canceled/i.test(msg)) {
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
  }
  if (record.stripeSubscriptionId) {
    // Delete only the still-pending row: if the first invoice was paid
    // the row is active and the record-level paid check above has
    // already refused; this predicate is the backstop.
    if (record.kind === "premium_directory") {
      await basePrisma.premiumDirectorySubscription.deleteMany({
        where: { stripeSubscriptionId: record.stripeSubscriptionId, status: "pending_payment" },
      });
    } else if (record.kind === "starred_board") {
      await basePrisma.starredBoardSubscription.deleteMany({
        where: { stripeSubscriptionId: record.stripeSubscriptionId, status: "pending_payment" },
      });
    }
  }
  await basePrisma.sponsorInvoice.update({
    where: { id: record.id },
    data: { status: "cancelled" },
  });
  return NextResponse.json({ ok: true });
}
