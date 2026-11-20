import Stripe from "stripe";
import { basePrisma } from "./db-base";
import { PREMIUM_LIVE_STATUSES, PREMIUM_PRICE_CENTS } from "./premium-directory";
import { STARRED_LIVE_STATUSES, STARRED_MAX_SPOTS, STARRED_PRICE_CENTS } from "./starred-board";
import {
  WEEK_TIERS,
  campaignPriceCents,
  countRunTaken,
  formatWeekRange,
  withWeekLock,
} from "./sponsor-weeks";

// Admin-sent sponsor invoices (Admin > Sponsors > Invoices). Mirrors the
// Presenting Partnership pattern (app/api/admin/partnerships): Stripe
// emails the invoice (collection_method: send_invoice, 7 days to pay)
// and the Stripe webhook turns the purchase on when invoice.paid lands.
//
// Monthly items (Premium Directory, Starred Community Board) are real
// subscriptions billed by invoice. The pending row is created with the
// same guards as the self-serve checkout routes, then the Stripe
// customer + subscription ids are stamped on the row AT CREATION.
// That stamp is critical: handlePremiumDirectoryEvent and
// handleStarredBoardEvent match invoice events by stripeSubscriptionId,
// so without it a payment would arrive and activation would silently
// no-op (the checkout flow only escapes this because its fulfillment
// matches by stripeSessionId first).
//
// The campaign is a one-off Stripe invoice whose metadata names the
// pending SponsorWeekBooking; the webhook's sponsor_week_invoice branch
// fulfills it via the shared fulfillPaidWeekBooking.
//
// Every invoice created here is recorded in SponsorInvoice so the admin
// list stays truthful; the webhook flips its status to paid.

export const SPONSOR_INVOICE_KINDS = ["premium_directory", "starred_board", "sponsor_week"] as const;
export type SponsorInvoiceKind = (typeof SPONSOR_INVOICE_KINDS)[number];
export type MonthlyInvoiceKind = "premium_directory" | "starred_board";

export function isSponsorInvoiceKind(v: unknown): v is SponsorInvoiceKind {
  return v === "premium_directory" || v === "starred_board" || v === "sponsor_week";
}

// An expected, user-facing failure (sold out, duplicate, not approved):
// the admin route returns it with its HTTP status instead of a 500.
export class SponsorInvoiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface InvoiceProfile {
  id: string;
  workspaceId: string;
  businessName: string;
  contactName: string;
  email: string;
  website: string | null;
  logoUrl: string | null;
  description: string | null;
}

export interface InvoiceListing {
  id: string;
  status: string;
}

const MONTHLY_DEFS: Record<MonthlyInvoiceKind, { cents: number; label: string; lookupKey: string }> = {
  premium_directory: {
    cents: PREMIUM_PRICE_CENTS,
    label: "Premium Directory Placement",
    lookupKey: "premium_directory_monthly",
  },
  starred_board: {
    cents: STARRED_PRICE_CENTS,
    label: "Starred Community Board",
    lookupKey: "starred_board_monthly",
  },
};

// Idempotent: find the recurring price by lookup key, or create product
// + price (same pattern as getOrCreatePrice in admin/partnerships).
async function getOrCreateMonthlyPrice(stripe: Stripe, kind: MonthlyInvoiceKind): Promise<string> {
  const def = MONTHLY_DEFS[kind];
  const existing = await stripe.prices.list({ lookup_keys: [def.lookupKey], limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;
  const product = await stripe.products.create({ name: def.label });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: def.cents,
    recurring: { interval: "month" },
    lookup_key: def.lookupKey,
  });
  return price.id;
}

// One Stripe customer per sponsor across every purchase path: reuse the
// id recorded on a prior admin invoice or premium/starred subscription
// for this sponsor (the checkout routes keep the id on the subscription
// rows; SponsorProfile carries none). Otherwise create the customer.
export async function getOrCreateSponsorCustomer(
  stripe: Stripe,
  profile: InvoiceProfile
): Promise<string> {
  const [priorInvoice, priorPremium, priorStarred] = await Promise.all([
    basePrisma.sponsorInvoice.findFirst({
      where: { sponsorId: profile.id },
      orderBy: { createdAt: "desc" },
      select: { stripeCustomerId: true },
    }),
    basePrisma.premiumDirectorySubscription.findFirst({
      where: { sponsorId: profile.id, stripeCustomerId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { stripeCustomerId: true },
    }),
    basePrisma.starredBoardSubscription.findFirst({
      where: { sponsorId: profile.id, stripeCustomerId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { stripeCustomerId: true },
    }),
  ]);
  const existing =
    priorInvoice?.stripeCustomerId || priorPremium?.stripeCustomerId || priorStarred?.stripeCustomerId;
  if (existing) return existing;
  const customer = await stripe.customers.create({
    name: profile.businessName,
    email: profile.email,
    metadata: {
      kind: "sponsor_invoice",
      sponsorId: profile.id,
      workspaceId: profile.workspaceId,
      contactName: profile.contactName,
    },
  });
  return customer.id;
}

// Create the pending_payment subscription row for a monthly item, with
// exactly the guards the self-serve checkout routes run (duplicate-live
// check for both; the Starred 5-spot cap under the workspace row lock).
// Returns the new row id. Throws SponsorInvoiceError on a guard failure.
async function createPendingMonthlyRow(
  kind: MonthlyInvoiceKind,
  workspaceId: string,
  profile: InvoiceProfile,
  listing: InvoiceListing
): Promise<string> {
  const def = MONTHLY_DEFS[kind];
  if (kind === "premium_directory") {
    const row = await basePrisma.$transaction(async (tx) => {
      const existing = await tx.premiumDirectorySubscription.findFirst({
        where: { workspaceId, spotlightId: listing.id, status: { in: [...PREMIUM_LIVE_STATUSES] } },
      });
      if (existing) throw new SponsorInvoiceError("This listing already has a Premium subscription.", 409);
      return tx.premiumDirectorySubscription.create({
        data: {
          workspaceId,
          spotlightId: listing.id,
          sponsorId: profile.id,
          status: "pending_payment",
          monthlyAmountCents: def.cents,
        },
      });
    });
    return row.id;
  }
  const row = await basePrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
    const taken = await tx.starredBoardSubscription.count({
      where: { workspaceId, status: { in: [...STARRED_LIVE_STATUSES] } },
    });
    if (taken >= STARRED_MAX_SPOTS) throw new SponsorInvoiceError("Starred spots are sold out.", 409);
    const existing = await tx.starredBoardSubscription.findFirst({
      where: { workspaceId, spotlightId: listing.id, status: { in: [...STARRED_LIVE_STATUSES] } },
    });
    if (existing) throw new SponsorInvoiceError("This listing already has a Starred subscription.", 409);
    return tx.starredBoardSubscription.create({
      data: {
        workspaceId,
        spotlightId: listing.id,
        sponsorId: profile.id,
        status: "pending_payment",
        monthlyAmountCents: def.cents,
      },
    });
  });
  return row.id;
}

async function stampMonthlyRowIds(
  kind: MonthlyInvoiceKind,
  rowId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<void> {
  if (kind === "premium_directory") {
    await basePrisma.premiumDirectorySubscription.update({
      where: { id: rowId },
      data: { stripeCustomerId, stripeSubscriptionId },
    });
  } else {
    await basePrisma.starredBoardSubscription.update({
      where: { id: rowId },
      data: { stripeCustomerId, stripeSubscriptionId },
    });
  }
}

async function deletePendingMonthlyRow(kind: MonthlyInvoiceKind, rowId: string): Promise<void> {
  if (kind === "premium_directory") {
    await basePrisma.premiumDirectorySubscription.delete({ where: { id: rowId } }).catch(() => {});
  } else {
    await basePrisma.starredBoardSubscription.delete({ where: { id: rowId } }).catch(() => {});
  }
}

// Premium Directory / Starred Community Board by invoice: create the
// pending row, then a send_invoice subscription on the sponsor's Stripe
// customer, stamp the ids on the row, and record the first invoice.
// Stripe emails that first invoice; paying it activates the row through
// the existing webhook lifecycle handlers. On any Stripe failure the
// subscription is cancelled and the pending row deleted, so an unsent
// invoice never squats on a Starred cap spot or blocks self-serve
// checkout for the listing.
export async function createMonthlySponsorInvoice(args: {
  stripe: Stripe;
  workspaceId: string;
  kind: MonthlyInvoiceKind;
  profile: InvoiceProfile;
  listing: InvoiceListing;
}) {
  const { stripe, workspaceId, kind, profile, listing } = args;
  const def = MONTHLY_DEFS[kind];
  if (listing.status !== "approved" && listing.status !== "active") {
    throw new SponsorInvoiceError(
      kind === "premium_directory"
        ? "This listing is still waiting for approval before it can go premium."
        : "This listing is still waiting for approval before it can be starred.",
      409
    );
  }

  const pendingRowId = await createPendingMonthlyRow(kind, workspaceId, profile, listing);

  let subscriptionId: string | null = null;
  try {
    const customerId = await getOrCreateSponsorCustomer(stripe, profile);
    const priceId = await getOrCreateMonthlyPrice(stripe, kind);
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: 7,
      description: `${def.label} — ${profile.businessName}`,
      items: [{ price: priceId }],
      expand: ["latest_invoice"],
      // Same routing metadata the checkout flow puts on the subscription,
      // so lifecycle events stay attributable even without a session.
      metadata: {
        workspaceId,
        kind,
        spotlightId: listing.id,
        sponsorId: profile.id,
        businessName: profile.businessName,
      },
    });
    subscriptionId = subscription.id;
    await stampMonthlyRowIds(kind, pendingRowId, customerId, subscription.id);

    let firstInvoice: Stripe.Invoice | null =
      typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
    if (!firstInvoice) {
      const list = await stripe.invoices.list({ subscription: subscription.id, limit: 1 });
      firstInvoice = list.data[0] ?? null;
    }
    if (!firstInvoice) {
      throw new Error("Stripe did not create a first invoice for the subscription.");
    }

    return await basePrisma.sponsorInvoice.create({
      data: {
        workspaceId,
        sponsorId: profile.id,
        spotlightId: listing.id,
        kind,
        amountCents: def.cents,
        stripeInvoiceId: firstInvoice.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        status: firstInvoice.status ?? "open",
        hostedInvoiceUrl: firstInvoice.hosted_invoice_url ?? null,
      },
    });
  } catch (err) {
    if (subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId).catch(() => {});
    }
    await deletePendingMonthlyRow(kind, pendingRowId);
    throw err;
  }
}

// 7-Issue Featured Campaign by invoice: create the pending booking under
// the week lock (same capacity guard as checkout and admin placement),
// then a one-off Stripe invoice carrying the booking id in metadata.
// Paying it fulfills the booking via the webhook's sponsor_week_invoice
// branch. On any Stripe failure the invoice is voided and the booking
// deleted, so the run slot frees up immediately.
export async function createCampaignSponsorInvoice(args: {
  stripe: Stripe;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  profile: InvoiceProfile;
  weekStart: string;
}) {
  const { stripe, workspaceId, workspaceSlug, workspaceName, profile, weekStart } = args;
  const tier = "standard" as const;
  const amountCents = campaignPriceCents(workspaceSlug);

  const booking = await withWeekLock(workspaceId, weekStart, async (tx) => {
    const week = await tx.sponsorWeek.upsert({
      where: { workspaceId_weekStart: { workspaceId, weekStart } },
      create: { workspaceId, weekStart },
      update: {},
      select: { id: true },
    });
    const taken = await countRunTaken(tx, workspaceId, weekStart, tier);
    if (taken >= WEEK_TIERS[tier].slots) {
      throw new SponsorInvoiceError("That campaign run is sold out. Pick another start day.", 409);
    }
    // Ad copy defaults: the sponsor's own listing copy when they have
    // one. Chad finalizes the copy before the run goes live (the booking
    // is created with chadWritesCopy, so projected rows wait in
    // pending_review until he approves the final copy).
    const listing = await tx.spotlightListing.findFirst({
      where: { workspaceId, sponsorId: profile.id },
      orderBy: { createdAt: "asc" },
      select: { description: true, logoUrl: true },
    });
    return tx.sponsorWeekBooking.create({
      data: {
        workspaceId,
        weekId: week.id,
        sponsorId: profile.id,
        tier,
        status: "pending_payment",
        amountCents,
        businessName: profile.businessName,
        contactName: profile.contactName,
        email: profile.email,
        website: profile.website ?? null,
        logoUrl: profile.logoUrl || listing?.logoUrl || "",
        aboutText: listing?.description || profile.description || profile.businessName,
        chadWritesCopy: true,
      },
    });
  });

  let stripeInvoiceId: string | null = null;
  try {
    const customerId = await getOrCreateSponsorCustomer(stripe, profile);
    const label = `${workspaceName} — ${WEEK_TIERS[tier].label} (${formatWeekRange(weekStart)}, 7 issues)`;
    const draft = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: 7,
      description: label,
      metadata: {
        workspaceId,
        kind: "sponsor_week_invoice",
        bookingId: booking.id,
        sponsorId: profile.id,
        businessName: profile.businessName,
      },
    });
    stripeInvoiceId = draft.id;
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: draft.id,
      amount: amountCents,
      currency: "usd",
      description: label,
    });
    const finalized = await stripe.invoices.finalizeInvoice(draft.id);
    // A send_invoice invoice is emailed by Stripe when it finalizes;
    // send explicitly as well so delivery never depends on that
    // behavior alone (re-sending an invoice is harmless).
    let sent = finalized;
    try {
      sent = await stripe.invoices.sendInvoice(draft.id);
    } catch (err) {
      console.error(`Campaign invoice ${draft.id} finalized but explicit send failed:`, err);
    }

    return await basePrisma.sponsorInvoice.create({
      data: {
        workspaceId,
        sponsorId: profile.id,
        spotlightId: null,
        kind: "sponsor_week",
        amountCents,
        stripeInvoiceId: draft.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
        bookingId: booking.id,
        status: sent.status ?? finalized.status ?? "open",
        hostedInvoiceUrl: sent.hosted_invoice_url ?? finalized.hosted_invoice_url ?? null,
      },
    });
  } catch (err) {
    if (stripeInvoiceId) {
      await stripe.invoices.voidInvoice(stripeInvoiceId).catch(() => {});
    }
    await basePrisma.sponsorWeekBooking.delete({ where: { id: booking.id } }).catch(() => {});
    throw err;
  }
}
