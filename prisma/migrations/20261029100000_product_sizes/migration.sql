-- Product size selection: a product can opt into apparel size selection
-- (offersSizes, off by default, so existing products behave exactly as
-- before). Buyers of such a product must pick one of the fixed sizes in
-- lib/product-sizes.ts before checkout; the chosen size is stored on the
-- order (nullable: orders for unsized products have none).
ALTER TABLE "Product" ADD COLUMN "offersSizes" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProductOrder" ADD COLUMN "size" TEXT;
