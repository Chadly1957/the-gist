-- Reader Rewards points storefront (2026-11-22): readers can spend points
-- as money (100 points = $1 by default) on Products and the Deals book
-- from their rewards portal. The only schema change records how many
-- points a purchase used, on the two existing purchase records. The cash
-- portion stays in the existing amount fields (ProductOrder.amountCents
-- already holds what the buyer actually paid). Additive only: two
-- nullable columns, no existing data touched.

-- AlterTable
ALTER TABLE "ProductOrder" ADD COLUMN "pointsApplied" INTEGER;

-- AlterTable
ALTER TABLE "CouponBookPurchase" ADD COLUMN "pointsApplied" INTEGER;
