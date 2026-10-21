-- Add legacy Stripe Payment Link mapping to Product.
ALTER TABLE "Product" ADD COLUMN "stripePaymentLinkId" TEXT;

-- CreateIndex
CREATE INDEX "Product_stripePaymentLinkId_idx" ON "Product"("stripePaymentLinkId");
