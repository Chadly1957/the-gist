-- Sponsor invoicing from admin (2026-11-20): one row per invoice an
-- admin sends a sponsor from Admin > Sponsors > Invoices. Monthly items
-- (Premium Directory, Starred Community Board) are send_invoice
-- subscriptions and this row tracks their first (activation) invoice;
-- campaign invoices are one-off Stripe invoices tied to a pending
-- SponsorWeekBooking. Additive only: one new table plus indexes; no
-- existing table is touched.
-- CreateTable
CREATE TABLE "SponsorInvoice" (
    "workspaceId" TEXT NOT NULL DEFAULT 'decatur',
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "spotlightId" TEXT,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "bookingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "hostedInvoiceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SponsorInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SponsorInvoice_stripeInvoiceId_key" ON "SponsorInvoice"("stripeInvoiceId");
CREATE UNIQUE INDEX "SponsorInvoice_id_workspaceId_key" ON "SponsorInvoice"("id", "workspaceId");
CREATE INDEX "SponsorInvoice_workspaceId_status_idx" ON "SponsorInvoice"("workspaceId", "status");
CREATE INDEX "SponsorInvoice_workspaceId_sponsorId_idx" ON "SponsorInvoice"("workspaceId", "sponsorId");
CREATE INDEX "SponsorInvoice_stripeCustomerId_idx" ON "SponsorInvoice"("stripeCustomerId");
CREATE INDEX "SponsorInvoice_stripeSubscriptionId_idx" ON "SponsorInvoice"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "SponsorInvoice" ADD CONSTRAINT "SponsorInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SponsorInvoice" ADD CONSTRAINT "SponsorInvoice_sponsorId_workspaceId_fkey" FOREIGN KEY ("sponsorId", "workspaceId") REFERENCES "SponsorProfile"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SponsorInvoice" ADD CONSTRAINT "SponsorInvoice_spotlightId_workspaceId_fkey" FOREIGN KEY ("spotlightId", "workspaceId") REFERENCES "SpotlightListing"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
