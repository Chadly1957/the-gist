-- Add requiresShipping to Product (default true: physical products collect a
-- shipping address at Stripe checkout; digital products can opt out).
ALTER TABLE "Product" ADD COLUMN "requiresShipping" BOOLEAN NOT NULL DEFAULT true;

-- Add shipping address columns to ProductOrder, captured from the Stripe
-- Checkout session when the order is paid. All nullable: orders placed
-- before this change and orders for digital products simply have none.
ALTER TABLE "ProductOrder" ADD COLUMN "shippingName" TEXT;
ALTER TABLE "ProductOrder" ADD COLUMN "shippingLine1" TEXT;
ALTER TABLE "ProductOrder" ADD COLUMN "shippingLine2" TEXT;
ALTER TABLE "ProductOrder" ADD COLUMN "shippingCity" TEXT;
ALTER TABLE "ProductOrder" ADD COLUMN "shippingState" TEXT;
ALTER TABLE "ProductOrder" ADD COLUMN "shippingPostalCode" TEXT;
ALTER TABLE "ProductOrder" ADD COLUMN "shippingCountry" TEXT;
