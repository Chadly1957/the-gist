import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { basePrisma } from "@/lib/db-base";
import { getWorkspace } from "@/lib/workspace";
import Stripe from "stripe";
import {
  createCampaignSponsorInvoice,
  createMonthlySponsorInvoice,
  isSponsorInvoiceKind,
  SponsorInvoiceError,
} from "@/lib/sponsor-invoicing";

export const dynamic = "force-dynamic";

// GET /api/admin/sponsors/invoices
// Invoices sent from this admin panel in the current workspace, newest
// first. Status is kept truthful by the Stripe webhook (paid flips on
// invoice.paid) and by the cancel action below.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId } = await getWorkspace();
  const invoices = await basePrisma.sponsorInvoice.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sponsor: { select: { businessName: true, contactName: true, email: true } },
    },
  });
  return NextResponse.json({ invoices });
}

// POST /api/admin/sponsors/invoices
// Body: { sponsorId, kind, spotlightId?, weekStart? }
// kind: "premium_directory" | "starred_board" | "sponsor_week".
// Creates the purchase in its pending state plus a Stripe invoice that
// Stripe emails to the business (7 days to pay). Paying the invoice is
// what turns the item on; see lib/sponsor-invoicing.ts and the webhook.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const workspace = await getWorkspace();
  const body = (await req.json().catch(() => ({}))) as {
    sponsorId?: string;
    kind?: string;
    spotlightId?: string;
    weekStart?: string;
  };

  const sponsorId = body.sponsorId?.trim();
  if (!sponsorId) return NextResponse.json({ error: "A sponsor is required." }, { status: 400 });
  if (!isSponsorInvoiceKind(body.kind)) {
    return NextResponse.json(
      { error: "Kind must be premium_directory, starred_board, or sponsor_week." },
      { status: 400 }
    );
  }
  const kind = body.kind;

  const profile = await basePrisma.sponsorProfile.findFirst({
    where: { id: sponsorId, workspaceId: workspace.id },
  });
  if (!profile) return NextResponse.json({ error: "Sponsor not found." }, { status: 404 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    if (kind === "sponsor_week") {
      const weekStart = body.weekStart?.trim() || "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        return NextResponse.json(
          { error: "Pick the campaign start day (YYYY-MM-DD)." },
          { status: 400 }
        );
      }
      const invoice = await createCampaignSponsorInvoice({
        stripe,
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        profile,
        weekStart,
      });
      // Stripe emails the invoice itself (send_invoice collection).
      return NextResponse.json({ ok: true, invoice, invoiceSentTo: profile.email });
    }

    // Monthly items attach to one of the sponsor's listings: the one the
    // admin picked, or their first listing when none was specified.
    const listing = body.spotlightId
      ? await basePrisma.spotlightListing.findFirst({
          where: { id: body.spotlightId, workspaceId: workspace.id, sponsorId: profile.id },
          select: { id: true, status: true },
        })
      : await basePrisma.spotlightListing.findFirst({
          where: { workspaceId: workspace.id, sponsorId: profile.id },
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true },
        });
    if (!listing) {
      return NextResponse.json(
        { error: "This business has no directory listing to attach the invoice to." },
        { status: 400 }
      );
    }

    const invoice = await createMonthlySponsorInvoice({
      stripe,
      workspaceId: workspace.id,
      kind,
      profile,
      listing,
    });
    return NextResponse.json({ ok: true, invoice, invoiceSentTo: profile.email });
  } catch (err) {
    if (err instanceof SponsorInvoiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("admin sponsor invoice create failed:", err);
    return NextResponse.json(
      { error: "Could not send the invoice. Please try again." },
      { status: 502 }
    );
  }
}
