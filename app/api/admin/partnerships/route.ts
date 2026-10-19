import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// Presenting Partnership pricing: annual price billed monthly.
// $4,000/yr one city  -> $333.33/mo
// $7,000/yr both      -> $583.33/mo
const TIER_PRICING: Record<string, { monthlyCents: number; label: string; lookupKey: string }> = {
  one_city: { monthlyCents: 33333, label: "Presenting Partnership — One City", lookupKey: "presenting_one_city_monthly" },
  both_cities: { monthlyCents: 58333, label: "Presenting Partnership — Both Cities", lookupKey: "presenting_both_cities_monthly" },
};

// Idempotent: find the recurring price by lookup key, or create product + price.
async function getOrCreatePrice(stripe: Stripe, tier: string): Promise<string> {
  const { monthlyCents, label, lookupKey } = TIER_PRICING[tier];
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const product = await stripe.products.create({ name: label });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: monthlyCents,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
  });
  return price.id;
}

const VALID_CATEGORIES = ["dining", "banking", "auto", "healthcare", "home_services", "retail"];

// POST /api/admin/partnerships
// Body: { businessName, contactName, email, category, tier, workspaceIds, notes? }
// Creates the Stripe customer + monthly subscription (collection_method: send_invoice),
// so Stripe emails the first invoice to the sponsor. They click, pay, done.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    businessName?: string;
    contactName?: string;
    email?: string;
    category?: string;
    tier?: string;
    workspaceIds?: string[];
    notes?: string;
    // Ad creative profile (optional at setup, goes live when paid)
    logoUrl?: string;
    website?: string;
    headline?: string;
    adBody?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    imageUrl?: string;
  };

  const businessName = body.businessName?.trim();
  const contactName = body.contactName?.trim();
  const email = body.email?.trim().toLowerCase();
  const category = body.category?.trim();
  const tier = body.tier?.trim();
  const workspaceIds = Array.isArray(body.workspaceIds) ? body.workspaceIds.filter(Boolean) : [];

  if (!businessName) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  if (!contactName) return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}` }, { status: 400 });
  }
  if (!tier || !TIER_PRICING[tier]) {
    return NextResponse.json({ error: "Tier must be one_city or both_cities." }, { status: 400 });
  }
  if (workspaceIds.length === 0) {
    return NextResponse.json({ error: "At least one city workspace is required." }, { status: 400 });
  }
  // One partner per category per city: block duplicates on active/pending partnerships.
  const clash = await basePrisma.presentingPartnership.findFirst({
    where: {
      category,
      status: { in: ["pending_payment", "active", "past_due"] },
      workspaceIds: { hasSome: workspaceIds },
    },
    select: { businessName: true, workspaceIds: true },
  });
  if (clash) {
    return NextResponse.json(
      { error: `${clash.businessName} already holds the ${category} slot in ${clash.workspaceIds.join(", ")}.` },
      { status: 409 }
    );
  }

  const { monthlyCents, label } = TIER_PRICING[tier];
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // 1. Stripe customer
  const customer = await stripe.customers.create({
    name: businessName,
    email,
    metadata: { contactName, category, tier, kind: "presenting_partnership" },
  });

  // 2. Monthly subscription, invoice emailed to the sponsor (they just click + pay).
  const priceId = await getOrCreatePrice(stripe, tier);
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 7,
    description: `${label} — ${businessName}`,
    items: [{ price: priceId }],
    metadata: {
      kind: "presenting_partnership",
      businessName,
      contactName,
      email,
      category,
      tier,
      workspaceIds: workspaceIds.join(","),
    },
  });

  // 3. Sponsor profile: find-or-create so the business exists in the system
  // with their logo and website. Ad creative rides on the partnership row.
  const logoUrl = body.logoUrl?.trim() || null;
  const website = body.website?.trim() || null;
  let sponsorProfileId: string | null = null;
  // SponsorProfile is workspace-scoped; create in the first workspace.
  const primaryWorkspace = workspaceIds[0];
  if (primaryWorkspace) {
    const existingProfile = await basePrisma.sponsorProfile.findFirst({
      where: { workspaceId: primaryWorkspace, email, businessName },
      select: { id: true },
    });
    if (existingProfile) {
      sponsorProfileId = existingProfile.id;
      await basePrisma.sponsorProfile.update({
        where: { id: existingProfile.id },
        data: { logoUrl, website },
      });
    } else {
      const profile = await basePrisma.sponsorProfile.create({
        data: {
          workspaceId: primaryWorkspace,
          businessName,
          contactName,
          email,
          website,
          logoUrl,
        },
      });
      sponsorProfileId = profile.id;
    }
  }

  // 4. Local partnership record, pending until the first invoice is paid.
  const partnership = await basePrisma.presentingPartnership.create({
    data: {
      businessName,
      contactName,
      email,
      category,
      tier,
      workspaceIds,
      monthlyAmountCents: monthlyCents,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      status: "pending_payment",
      sponsorProfileId,
      logoUrl,
      website,
      headline: body.headline?.trim() || null,
      body: body.adBody?.trim() || null,
      ctaLabel: body.ctaLabel?.trim() || null,
      ctaUrl: body.ctaUrl?.trim() || null,
      imageUrl: body.imageUrl?.trim() || null,
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({
    ok: true,
    partnership: {
      id: partnership.id,
      businessName,
      email,
      tier,
      monthlyAmountCents: monthlyCents,
      status: partnership.status,
      stripeSubscriptionId: subscription.id,
    },
    // Stripe emails the invoice automatically with collection_method: send_invoice.
    invoiceSentTo: email,
  });
}

// GET /api/admin/partnerships — list all partnerships, newest first.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partnerships = await basePrisma.presentingPartnership.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ partnerships });
}
